import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Chapter, Choice, Comic } from "./types";
import {
  generateChoices,
  generateNextChapter,
  describeChapterScenes,
  type StorySoFar,
} from "./ai";
import { searchImage } from "./images";
import { splitIntoParts } from "./chapter";
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

/**
 * Build the panel images for a freshly generated chapter. For a single image
 * we reuse the chapter's own scene phrase. For several, we split the chapter
 * into that many ordered parts and ask the AI for a scene per part, so the
 * sequence of images follows the story's flow. Best-effort: any failure yields
 * fewer (or no) images rather than blocking the chapter.
 */
async function buildChapterImages(
  comic: Pick<Comic, "title" | "description">,
  generated: { title: string; content_text: string; image_query: string | null },
  count: number,
  signal?: AbortSignal
): Promise<string[]> {
  const n = Math.max(1, Math.floor(count) || 1);
  try {
    if (n <= 1) {
      const url = generated.image_query
        ? await searchImage(generated.image_query, signal)
        : null;
      return url ? [url] : [];
    }

    const parts = splitIntoParts(generated.content_text, n);
    const queries = await describeChapterScenes(
      { title: comic.title, description: comic.description },
      generated.title,
      parts,
      signal
    );
    const urls = (
      await Promise.all(queries.map((q) => searchImage(q, signal)))
    ).filter((u): u is string => Boolean(u));
    if (urls.length > 0) return urls;

    // Nothing came back — fall back to a single scene so the chapter isn't bare.
    const one = generated.image_query
      ? await searchImage(generated.image_query, signal)
      : null;
    return one ? [one] : [];
  } catch {
    return [];
  }
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

  // Draw the panels (text model can't draw), split to follow the story flow.
  const imageUrls = await buildChapterImages(
    { title: comic.title, description: comic.description },
    generated,
    imageCount,
    signal
  );

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
