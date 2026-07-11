import type { Chapter, Choice, ChoiceRecord } from "./types";

/**
 * Pure helpers for progress/choice bookkeeping.
 *
 * These are intentionally free of any I/O (no Supabase, no fetch) so the core
 * "recording a choice" logic can be unit-tested in isolation. The server
 * actions in app/actions/reading.ts compose these with the database.
 */

/** Build a compact, serializable record of a choice the reader just made. */
export function buildChoiceRecord(
  choice: Pick<Choice, "id" | "chapter_id" | "description">,
  now: Date = new Date()
): ChoiceRecord {
  return {
    chapter_id: choice.chapter_id,
    choice_id: choice.id,
    choice_description: choice.description,
    selected_at: now.toISOString(),
  };
}

/**
 * Append a choice to a reader's history.
 *
 * Choosing again on a chapter the reader already answered (e.g. after going
 * back) replaces the earlier record for that chapter rather than duplicating
 * it, so `choices_made` always reflects a single coherent path.
 */
export function appendChoice(
  history: ChoiceRecord[],
  record: ChoiceRecord
): ChoiceRecord[] {
  const withoutSameChapter = history.filter(
    (r) => r.chapter_id !== record.chapter_id
  );
  return [...withoutSameChapter, record];
}

/**
 * Decide where a chosen option should lead.
 *  - "existing": the choice already points at a chapter (pre-authored or a
 *    path a previous reader generated) — just navigate there.
 *  - "generate": no destination yet — the caller must ask the AI to create the
 *    next chapter, then backfill `leads_to_chapter_id`.
 */
export function resolveNextChapter(
  choice: Pick<Choice, "leads_to_chapter_id">
): { kind: "existing"; chapterId: string } | { kind: "generate" } {
  if (choice.leads_to_chapter_id) {
    return { kind: "existing", chapterId: choice.leads_to_chapter_id };
  }
  return { kind: "generate" };
}

/** The chapter_number to assign to a freshly generated chapter. */
export function nextChapterNumber(fromChapter: Pick<Chapter, "chapter_number">): number {
  return fromChapter.chapter_number + 1;
}
