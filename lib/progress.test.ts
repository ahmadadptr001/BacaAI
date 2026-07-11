import { describe, it, expect } from "vitest";
import {
  appendChoice,
  buildChoiceRecord,
  nextChapterNumber,
  resolveNextChapter,
} from "./progress";
import type { ChoiceRecord } from "./types";

describe("buildChoiceRecord", () => {
  it("captures the choice and chapter with an ISO timestamp", () => {
    const now = new Date("2026-07-10T12:00:00.000Z");
    const record = buildChoiceRecord(
      { id: "choice-1", chapter_id: "chap-1", description: "Open the door" },
      now
    );
    expect(record).toEqual({
      chapter_id: "chap-1",
      choice_id: "choice-1",
      choice_description: "Open the door",
      selected_at: "2026-07-10T12:00:00.000Z",
    });
  });
});

describe("appendChoice", () => {
  const base: ChoiceRecord = {
    chapter_id: "chap-1",
    choice_id: "choice-a",
    choice_description: "Go left",
    selected_at: "2026-07-10T12:00:00.000Z",
  };

  it("adds a new choice to empty history", () => {
    expect(appendChoice([], base)).toEqual([base]);
  });

  it("appends choices from different chapters in order", () => {
    const second: ChoiceRecord = {
      chapter_id: "chap-2",
      choice_id: "choice-b",
      choice_description: "Climb the wall",
      selected_at: "2026-07-10T12:05:00.000Z",
    };
    const result = appendChoice([base], second);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(second);
  });

  it("replaces an earlier choice for the same chapter (re-deciding a branch)", () => {
    const redo: ChoiceRecord = {
      chapter_id: "chap-1",
      choice_id: "choice-c",
      choice_description: "Go right instead",
      selected_at: "2026-07-10T12:10:00.000Z",
    };
    const result = appendChoice([base], redo);
    expect(result).toHaveLength(1);
    expect(result[0].choice_id).toBe("choice-c");
  });

  it("does not mutate the input array", () => {
    const history = [base];
    appendChoice(history, {
      chapter_id: "chap-9",
      choice_id: "x",
      choice_description: "y",
      selected_at: "z",
    });
    expect(history).toHaveLength(1);
  });
});

describe("resolveNextChapter", () => {
  it("navigates to an existing (cached) chapter when linked", () => {
    expect(resolveNextChapter({ leads_to_chapter_id: "chap-42" })).toEqual({
      kind: "existing",
      chapterId: "chap-42",
    });
  });

  it("requests AI generation when no destination exists", () => {
    expect(resolveNextChapter({ leads_to_chapter_id: null })).toEqual({
      kind: "generate",
    });
  });
});

describe("nextChapterNumber", () => {
  it("increments the current chapter number", () => {
    expect(nextChapterNumber({ chapter_number: 3 })).toBe(4);
  });
});
