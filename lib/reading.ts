import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CastMember, Chapter, Choice, Comic } from "./types";
import {
  generateChoices,
  generateNextChapter,
  planChapterArt,
  type StorySoFar,
} from "./ai";
import { searchImage } from "./images";
import { splitIntoParts } from "./chapter";
import { createAdminClient } from "./supabase/admin";
import { nextChapterNumber } from "./progress";

/**
 * Server-side reading engine: given a choice, figure out the next chapter,
 * generating and caching it with the AI when the path doesn't exist yet.
 *
 * All functions here take an authenticated Supabase client (RLS enforces that
 * users only touch their own progress rows).
 */

type DB = SupabaseClient;

/**
 * How many of the most-recent chapters to feed the AI. Keeping a bounded window
 * (instead of the entire story) stops the prompt from ballooning on long paths
 * — important on CPU-only hosts — and reduces the model fixating on the same
 * characters/scenes. The opening chapter is always included for grounding, so
 * the AI effectively sees: chapter 1 + the last MAX_RECENT_CHAPTERS.
 * Override with AI_CONTEXT_CHAPTERS. Default 5 is a good balance.
 */
const MAX_RECENT_CHAPTERS = (() => {
  const n = Number(process.env.AI_CONTEXT_CHAPTERS);
  return Number.isFinite(n) && n >= 2 ? Math.floor(n) : 5;
})();

/** Trim a full lineage to the context window sent to the AI. */
function contextWindow(lineage: Chapter[]): Chapter[] {
  if (lineage.length <= MAX_RECENT_CHAPTERS + 1) return lineage;
  // Opening chapter (grounding) + the most recent chapters.
  return [lineage[0], ...lineage.slice(-MAX_RECENT_CHAPTERS)];
}

/**
 * Walk backwards from a chapter to the opening chapter, returning the full
 * lineage (root → given chapter) in order. Each generated chapter is the
 * target of exactly one choice's `leads_to_chapter_id`, so the path back is
 * deterministic. This is what we feed the AI so it never loses context.
 */
export async function getChapterLineage(
  supabase: DB,
  chapterId: string
): Promise<Chapter[]> {
  const chain: Chapter[] = [];
  const seen = new Set<string>();
  let currentId: string | null = chapterId;

  while (currentId !== null && !seen.has(currentId)) {
    const id: string = currentId;
    seen.add(id);

    const chapterRes = await supabase
      .from("chapters")
      .select("*")
      .eq("id", id)
      .maybeSingle<Chapter>();
    const chapter = chapterRes.data;
    if (!chapter) break;
    chain.unshift(chapter);

    const parentRes = await supabase
      .from("choices")
      .select("chapter_id")
      .eq("leads_to_chapter_id", id)
      .limit(1)
      .maybeSingle<{ chapter_id: string }>();
    currentId = parentRes.data?.chapter_id ?? null;
  }

  return chain;
}

function toStorySoFar(chapters: Chapter[]): StorySoFar {
  return chapters.map((c) => ({
    chapter_number: c.chapter_number,
    title: c.title,
    content_text: c.content_text,
  }));
}

/** Load the choice + its comic needed to generate the next chapter. */
async function loadChoiceContext(supabase: DB, choiceId: string) {
  const { data: choice, error: choiceErr } = await supabase
    .from("choices")
    .select("*")
    .eq("id", choiceId)
    .single<Choice>();
  if (choiceErr || !choice) throw new Error("Choice not found");

  const { data: chapter, error: chapterErr } = await supabase
    .from("chapters")
    .select("*")
    .eq("id", choice.chapter_id)
    .single<Chapter>();
  if (chapterErr || !chapter) throw new Error("Chapter not found");

  const { data: comic, error: comicErr } = await supabase
    .from("comics")
    .select("*")
    .eq("id", chapter.comic_id)
    .single<Comic>();
  if (comicErr || !comic) throw new Error("Comic not found");

  return { choice, chapter, comic };
}

/**
 * Ensure a chapter has decision-point choices, generating them with the AI if
 * it has none yet (e.g. the opening chapter an admin authored). Idempotent.
 * The AI receives the whole story so far for consistency.
 */
export async function generateChoicesForChapter(
  supabase: DB,
  chapterId: string,
  signal?: AbortSignal
): Promise<Choice[]> {
  const { data: existing } = await supabase
    .from("choices")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("sort_order", { ascending: true });
  if (existing && existing.length > 0) return existing as Choice[];

  const lineage = await getChapterLineage(supabase, chapterId);
  if (lineage.length === 0) throw new Error("Chapter not found");

  const { data: comic, error: comicErr } = await supabase
    .from("comics")
    .select("*")
    .eq("id", lineage[0].comic_id)
    .single<Comic>();
  if (comicErr || !comic) throw new Error("Comic not found");

  const descriptions = await generateChoices(
    { title: comic.title, description: comic.description },
    toStorySoFar(contextWindow(lineage)),
    signal
  );

  const { data: inserted, error: insertErr } = await supabase
    .from("choices")
    .insert(
      descriptions.map((description, sort_order) => ({
        chapter_id: chapterId,
        description,
        sort_order,
      }))
    )
    .select("*");
  if (insertErr) throw new Error("Failed to save generated choices");

  return (inserted ?? []) as Choice[];
}

/** Parse the stored cast sheet (jsonb) into a typed, validated array. */
function parseCast(value: Comic["character_sheet"]): CastMember[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (c): c is CastMember =>
        !!c && typeof c.name === "string" && typeof c.brief === "string"
    )
    .map((c) => ({ name: c.name, brief: c.brief }));
}

/** Merge newly-introduced characters into the locked cast (existing wins). */
function mergeCast(
  existing: CastMember[],
  additions: CastMember[]
): CastMember[] {
  const seen = new Set(existing.map((c) => c.name.toLowerCase()));
  const merged = [...existing];
  for (const c of additions) {
    const key = c.name.toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(c);
    }
  }
  return merged;
}

/**
 * Build the panel images for a freshly generated chapter AND keep the comic's
 * cast registry up to date. Splits the chapter into `count` ordered parts, then
 * asks the AI to (a) lock the look of any newly appearing character and (b) map
 * each part to a scene + the characters present in it. Each character's fixed
 * description is prepended to the scenes they appear in, so EVERY character (not
 * just the lead) looks the same whenever redrawn. Returns the images and the
 * (possibly grown) cast. Best-effort: any failure falls back to a single plain
 * image.
 */
async function buildChapterImages(
  comic: Pick<Comic, "title" | "description">,
  generated: { title: string; content_text: string; image_query: string | null },
  count: number,
  existingCast: CastMember[],
  signal?: AbortSignal
): Promise<{ urls: string[]; cast: CastMember[] }> {
  const n = Math.max(1, Math.floor(count) || 1);
  const parts = splitIntoParts(generated.content_text, n);

  try {
    const plan = await planChapterArt(
      { title: comic.title, description: comic.description },
      generated.title,
      parts,
      existingCast,
      signal
    );
    const cast = mergeCast(existingCast, plan.newCharacters);
    const briefByName = new Map(
      cast.map((c) => [c.name.toLowerCase(), c.brief])
    );

    const prompts = parts.map((_, i) => {
      const panel = plan.panels[i] ?? plan.panels[plan.panels.length - 1];
      const scene =
        panel?.scene?.trim() || generated.image_query || "cinematic anime scene";
      const briefs = (panel?.characters ?? [])
        .map((name) => briefByName.get(name.toLowerCase()))
        .filter((b): b is string => Boolean(b));
      // Character looks first (locked), then what's happening + where.
      return [...briefs, scene].join(". ");
    });

    const urls = (
      await Promise.all(prompts.map((p) => searchImage(p, signal)))
    ).filter((u): u is string => Boolean(u));
    if (urls.length > 0) return { urls, cast };
  } catch {
    // fall through to the plain fallback below
  }

  // Fallback: a single image from the chapter's own scene phrase, no cast.
  const one = generated.image_query
    ? await searchImage(generated.image_query, signal)
    : null;
  return { urls: one ? [one] : [], cast: existingCast };
}

/**
 * Resolve the destination chapter for a choice.
 *  - If the choice already links to a chapter, return it (cached path).
 *  - Otherwise call the AI with the full story so far, insert the new chapter
 *    (+ `imageCount` fitting panel images and its follow-up choices), backfill
 *    `leads_to_chapter_id`, and return the new chapter id.
 *
 * `imageCount` is the reader's chosen number of panels for THIS newly generated
 * chapter (already clamped to their role's max by the caller).
 */
export async function advanceFromChoice(
  supabase: DB,
  choiceId: string,
  imageCount = 1,
  signal?: AbortSignal
): Promise<string> {
  const { choice, chapter, comic } = await loadChoiceContext(supabase, choiceId);

  // Cached path — a previous reader already generated this branch.
  if (choice.leads_to_chapter_id) {
    return choice.leads_to_chapter_id;
  }

  // Full story so far (root → current chapter) keeps the AI consistent.
  const lineage = await getChapterLineage(supabase, chapter.id);

  const generated = await generateNextChapter(
    {
      comic: { title: comic.title, description: comic.description },
      history: toStorySoFar(contextWindow(lineage)),
      choice: { description: choice.description },
    },
    signal
  );

  // Keep a cast registry on the comic so EVERY character (not just the lead)
  // keeps the same look whenever redrawn, then draw the panels along the flow.
  const existingCast = parseCast(comic.character_sheet);
  const { urls: imageUrls, cast } = await buildChapterImages(
    { title: comic.title, description: comic.description },
    generated,
    imageCount,
    existingCast,
    signal
  );
  // Persist any newly introduced characters (service role: comics has no UPDATE
  // RLS policy). Best-effort — never block a chapter on it.
  if (cast.length > existingCast.length) {
    try {
      await createAdminClient()
        .from("comics")
        .update({ character_sheet: cast })
        .eq("id", comic.id);
    } catch {
      // best-effort cache
    }
  }

  const { data: newChapter, error: insertErr } = await supabase
    .from("chapters")
    .insert({
      comic_id: comic.id,
      chapter_number: nextChapterNumber(chapter),
      title: generated.title,
      content_text: generated.content_text,
      image_urls: imageUrls,
      is_generated: true,
    })
    .select("*")
    .single<Chapter>();
  if (insertErr || !newChapter) {
    throw new Error("Failed to save generated chapter");
  }

  // Attach the AI-suggested follow-up choices to the new chapter.
  if (generated.choices.length) {
    await supabase.from("choices").insert(
      generated.choices.map((description, sort_order) => ({
        chapter_id: newChapter.id,
        description,
        sort_order,
      }))
    );
  }

  // Cache the branch so future readers reuse this chapter.
  await supabase
    .from("choices")
    .update({ leads_to_chapter_id: newChapter.id })
    .eq("id", choice.id);

  return newChapter.id;
}
