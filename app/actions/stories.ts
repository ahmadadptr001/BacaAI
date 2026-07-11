"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateChoicesForChapter } from "@/lib/reading";
import { suggestComic } from "@/lib/ai";
import { searchImage } from "@/lib/images";
import type { Chapter, Comic } from "@/lib/types";

export interface StoryActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Id of the story just created, for linking/redirecting to it. */
  comicId?: string;
}

export interface ComicDraft {
  title: string;
  description: string;
  story: string;
  imageUrl: string;
}

export interface SuggestComicState {
  ok?: boolean;
  error?: string;
  draft?: ComicDraft;
}

/**
 * AI recommendation for the "create story" form: drafts a title, synopsis,
 * opening chapter (Bab 1), and a matching cover image URL, seeded by whatever
 * the writer typed. Available to any signed-in user; saves nothing.
 */
export async function suggestComicDraft(seed: {
  title?: string;
  hint?: string;
}): Promise<SuggestComicState> {
  const { user } = await getAuthContext();
  if (!user) return { error: "Kamu perlu masuk terlebih dahulu." };

  try {
    const s = await suggestComic({
      title: seed.title?.trim() || undefined,
      hint: seed.hint?.trim() || undefined,
    });

    // Turn the cover scene into an on-topic anime-style image URL.
    let imageUrl = "";
    if (s.image_query) {
      try {
        imageUrl = (await searchImage(s.image_query)) ?? "";
      } catch {
        imageUrl = "";
      }
    }

    return {
      ok: true,
      draft: {
        title: s.title,
        description: s.description,
        story: s.story,
        imageUrl,
      },
    };
  } catch {
    return {
      error: "AI belum bisa memberi rekomendasi sekarang. Coba lagi sebentar.",
    };
  }
}

/**
 * Publish a story from minimal input: title, synopsis, opening story, and a
 * cover image URL. Available to ANY signed-in reader (not just admins). We
 * store the opening story as chapter 1, tagged with its author, then best-effort
 * ask the AI to generate the first decision-point options — the rest of the
 * branching story unfolds as readers make choices.
 */
export async function createComic(
  _prev: StoryActionState,
  formData: FormData
): Promise<StoryActionState> {
  const { user } = await getAuthContext();
  if (!user) return { error: "Kamu perlu masuk terlebih dahulu." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const story = String(formData.get("story") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();

  if (!title || !story) {
    return { error: "Judul dan cerita awal wajib diisi." };
  }

  const admin = createAdminClient();

  const { data: comic, error: comicErr } = await admin
    .from("comics")
    .insert({
      title,
      description: description || null,
      cover_image_url: imageUrl || null,
      created_by: user.id,
    })
    .select("*")
    .single<Comic>();
  if (comicErr || !comic) {
    return { error: "Gagal menyimpan cerita. Silakan coba lagi." };
  }

  const { data: chapter, error: chapterErr } = await admin
    .from("chapters")
    .insert({
      comic_id: comic.id,
      chapter_number: 1,
      title: "Bab 1",
      content_text: story,
      image_urls: imageUrl ? [imageUrl] : [],
    })
    .select("*")
    .single<Chapter>();
  if (chapterErr || !chapter) {
    // Roll back the comic so we don't leave a chapterless entry.
    await admin.from("comics").delete().eq("id", comic.id);
    return { error: "Gagal menyimpan cerita awal. Silakan coba lagi." };
  }

  // Best-effort: generate the opening choices now so readers (incl. guests)
  // see options immediately. If the AI is unavailable, choices are generated
  // later when the first signed-in reader opens the chapter.
  let message = "Cerita berhasil dibuat!";
  try {
    await generateChoicesForChapter(admin, chapter.id);
  } catch {
    message =
      "Cerita dibuat, tapi pilihan awal belum bisa dibuat AI (akan dibuat saat pertama dibaca).";
  }

  revalidatePath("/");
  revalidatePath("/jelajah");
  revalidatePath("/admin");
  revalidatePath("/admin/komik");
  revalidatePath("/cerita-saya");
  return { ok: true, message, comicId: comic.id };
}

/** Delete a story — only the reader who created it may do so. */
export async function deleteOwnStory(
  comicId: string
): Promise<StoryActionState> {
  const { user } = await getAuthContext();
  if (!user) return { error: "Kamu perlu masuk terlebih dahulu." };

  const admin = createAdminClient();
  const { data: comic } = await admin
    .from("comics")
    .select("id, created_by")
    .eq("id", comicId)
    .maybeSingle<{ id: string; created_by: string | null }>();
  if (!comic || comic.created_by !== user.id) {
    return { error: "Cerita tidak ditemukan atau bukan milikmu." };
  }

  const { error } = await admin.from("comics").delete().eq("id", comicId);
  if (error) return { error: "Gagal menghapus cerita." };

  revalidatePath("/cerita-saya");
  revalidatePath("/");
  revalidatePath("/jelajah");
  return { ok: true };
}
