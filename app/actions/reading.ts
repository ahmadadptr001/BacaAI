"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/authz";
import { advanceFromChoice, generateChoicesForChapter } from "@/lib/reading";
import { appendChoice, buildChoiceRecord } from "@/lib/progress";
import { describeChapterScenes } from "@/lib/ai";
import { searchImage } from "@/lib/images";
import { splitIntoParts, maxImagesFor } from "@/lib/chapter";
import type { Chapter, Choice, Comic, ChoiceRecord, UserProgress } from "@/lib/types";

export interface SelectChoiceResult {
  ok: boolean;
  nextChapterId?: string;
  error?: string;
}

/**
 * Ensure a user_progress row exists for (user, comic), returning it.
 * New rows start at the comic's first chapter.
 */
async function getOrCreateProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  comicId: string
): Promise<UserProgress> {
  const { data: existing } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("comic_id", comicId)
    .maybeSingle<UserProgress>();
  if (existing) return existing;

  const { data: firstChapter } = await supabase
    .from("chapters")
    .select("id")
    .eq("comic_id", comicId)
    .order("chapter_number", { ascending: true })
    .limit(1)
    .single<Pick<Chapter, "id">>();

  const { data: created, error } = await supabase
    .from("user_progress")
    .insert({
      user_id: userId,
      comic_id: comicId,
      current_chapter_id: firstChapter?.id ?? null,
      choices_made: [],
    })
    .select("*")
    .single<UserProgress>();
  if (error || !created) throw new Error("Could not create progress");
  return created;
}

/**
 * Record the reader's choice, generate/resolve the next chapter, and advance
 * their saved progress. Returns the next chapter id for client navigation.
 *
 * Runs entirely on the server: it re-checks auth (Server Functions are
 * reachable by direct POST) and relies on RLS for row ownership.
 */
export async function selectChoice(
  comicId: string,
  choiceId: string
): Promise<SelectChoiceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Kamu perlu masuk terlebih dahulu." };

  try {
    const { data: choice } = await supabase
      .from("choices")
      .select("*")
      .eq("id", choiceId)
      .single<Choice>();
    if (!choice)
      return { ok: false, error: "Pilihan tersebut sudah tidak tersedia." };

    const progress = await getOrCreateProgress(supabase, user.id, comicId);

    // Log the choice (append-only) and generate/resolve the next chapter.
    await supabase.from("user_choices").insert({
      user_progress_id: progress.id,
      chapter_id: choice.chapter_id,
      choice_id: choice.id,
    });

    const nextChapterId = await advanceFromChoice(supabase, choiceId);

    // Update the progress snapshot: current chapter + choices_made history.
    const record: ChoiceRecord = buildChoiceRecord(choice);
    const updatedHistory = appendChoice(progress.choices_made ?? [], record);
    await supabase
      .from("user_progress")
      .update({
        current_chapter_id: nextChapterId,
        choices_made: updatedHistory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", progress.id);

    revalidatePath(`/comics/${comicId}`);
    return { ok: true, nextChapterId };
  } catch (err) {
    console.error("selectChoice failed:", err);
    return {
      ok: false,
      error: "Sang pencerita sedang beristirahat. Silakan coba lagi.",
    };
  }
}

/**
 * Let the reader write their OWN plot direction instead of picking a preset
 * option. We store it as a hidden `is_custom` choice on the current chapter
 * (so it doesn't clutter other readers' options), then generate the next
 * chapter from it exactly like a normal choice.
 */
export async function writeOwnDirection(
  comicId: string,
  chapterId: string,
  description: string
): Promise<SelectChoiceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Kamu perlu masuk terlebih dahulu." };

  const text = description.trim().slice(0, 300);
  if (text.length < 3) {
    return { ok: false, error: "Tulis dulu arah cerita yang kamu inginkan." };
  }

  try {
    const { data: choice, error: choiceErr } = await supabase
      .from("choices")
      .insert({
        chapter_id: chapterId,
        description: text,
        sort_order: 999,
        is_custom: true,
      })
      .select("*")
      .single<Choice>();
    if (choiceErr || !choice) {
      return { ok: false, error: "Gagal menyimpan arahmu. Silakan coba lagi." };
    }

    const progress = await getOrCreateProgress(supabase, user.id, comicId);

    await supabase.from("user_choices").insert({
      user_progress_id: progress.id,
      chapter_id: chapterId,
      choice_id: choice.id,
    });

    const nextChapterId = await advanceFromChoice(supabase, choice.id);

    const record: ChoiceRecord = buildChoiceRecord(choice);
    const updatedHistory = appendChoice(progress.choices_made ?? [], record);
    await supabase
      .from("user_progress")
      .update({
        current_chapter_id: nextChapterId,
        choices_made: updatedHistory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", progress.id);

    revalidatePath(`/comics/${comicId}`);
    return { ok: true, nextChapterId };
  } catch (err) {
    console.error("writeOwnDirection failed:", err);
    return {
      ok: false,
      error: "Sang pencerita sedang beristirahat. Silakan coba lagi.",
    };
  }
}

/**
 * Make sure the given chapter has AI-generated decision-point options.
 * Called by the reader when it lands on a chapter that has no choices yet
 * (e.g. the opening chapter an admin wrote). Requires sign-in because writing
 * choices needs an authenticated session (RLS).
 */
export async function ensureChoices(chapterId: string): Promise<SelectChoiceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Kamu perlu masuk terlebih dahulu." };

  try {
    await generateChoicesForChapter(supabase, chapterId);
    return { ok: true };
  } catch (err) {
    console.error("ensureChoices failed:", err);
    return {
      ok: false,
      error: "Sang pencerita sedang beristirahat. Silakan coba lagi.",
    };
  }
}

/**
 * (Re)generate the panel images for a chapter. The reader picks how many
 * images they want (1..max, where max is 4 for readers and 6 for admins). The
 * chapter is split into that many ordered parts, and the AI writes an image
 * prompt matching EACH part, so the sequence of images tracks the story's flow.
 * Images are shared on the chapter (like generated chapters/choices), so we
 * write them with the service-role client (chapters have no UPDATE RLS policy).
 */
export async function setChapterImages(
  comicId: string,
  chapterId: string,
  count: number
): Promise<SelectChoiceResult> {
  const { user, isAdmin } = await getAuthContext();
  if (!user) return { ok: false, error: "Kamu perlu masuk terlebih dahulu." };

  const max = maxImagesFor(isAdmin);
  const n = Math.max(1, Math.min(max, Math.floor(count) || 1));

  const admin = createAdminClient();
  const { data: chapter } = await admin
    .from("chapters")
    .select("id, comic_id, title, content_text")
    .eq("id", chapterId)
    .maybeSingle<Pick<Chapter, "id" | "comic_id" | "title" | "content_text">>();
  if (!chapter || chapter.comic_id !== comicId) {
    return { ok: false, error: "Bab tidak ditemukan." };
  }

  const { data: comic } = await admin
    .from("comics")
    .select("title, description")
    .eq("id", comicId)
    .maybeSingle<Pick<Comic, "title" | "description">>();

  try {
    const parts = splitIntoParts(chapter.content_text, n);
    const queries = await describeChapterScenes(
      { title: comic?.title ?? chapter.title, description: comic?.description ?? null },
      chapter.title,
      parts
    );

    // Generate every panel in parallel; searchImage falls back internally so a
    // panel is never left empty. Order is preserved → image i ↔ part i.
    const urls = (await Promise.all(queries.map((q) => searchImage(q)))).filter(
      (u): u is string => Boolean(u)
    );
    if (urls.length === 0) {
      return { ok: false, error: "Gagal membuat gambar. Coba lagi sebentar." };
    }

    const { error } = await admin
      .from("chapters")
      .update({ image_urls: urls })
      .eq("id", chapterId);
    if (error) return { ok: false, error: "Gagal menyimpan gambar." };

    revalidatePath(`/comics/${comicId}`);
    return { ok: true };
  } catch (err) {
    console.error("setChapterImages failed:", err);
    return {
      ok: false,
      error: "Sang pencerita sedang beristirahat. Silakan coba lagi.",
    };
  }
}

/**
 * Restart a comic from chapter 1: clears the choice log and resets progress
 * so the reader can explore a different path.
 */
export async function restartComic(comicId: string): Promise<SelectChoiceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Kamu perlu masuk terlebih dahulu." };

  const progress = await getOrCreateProgress(supabase, user.id, comicId);

  const { data: firstChapter } = await supabase
    .from("chapters")
    .select("id")
    .eq("comic_id", comicId)
    .order("chapter_number", { ascending: true })
    .limit(1)
    .single<Pick<Chapter, "id">>();

  // Truly wipe the AI's memory of this story: delete every AI-generated chapter
  // for the comic. Deleting them cascades to their choices, and resets the
  // opening chapter's `leads_to_chapter_id` back to NULL (FK on delete set
  // null) — so a fresh playthrough regenerates the whole story from scratch.
  await supabase
    .from("chapters")
    .delete()
    .eq("comic_id", comicId)
    .eq("is_generated", true);

  await supabase.from("user_choices").delete().eq("user_progress_id", progress.id);
  await supabase
    .from("user_progress")
    .update({
      current_chapter_id: firstChapter?.id ?? null,
      choices_made: [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", progress.id);

  revalidatePath(`/comics/${comicId}`);
  return { ok: true, nextChapterId: firstChapter?.id };
}
