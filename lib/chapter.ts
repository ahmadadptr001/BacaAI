/**
 * Chapter presentation helpers shared by the server (image generation) and the
 * reader page (rendering). Pure + framework-free so both sides split a chapter
 * into the SAME parts, keeping each generated image aligned with its text.
 */

/** How many panel images a chapter may have, by role. */
export const MAX_IMAGES_USER = 4;
export const MAX_IMAGES_ADMIN = 6;

export function maxImagesFor(isAdmin: boolean): number {
  return isAdmin ? MAX_IMAGES_ADMIN : MAX_IMAGES_USER;
}

/**
 * Split chapter text into up to `n` contiguous parts that follow the story's
 * flow. Splits on paragraphs first; if there aren't enough paragraphs to reach
 * `n`, falls back to sentences for finer granularity. Returns between 1 and `n`
 * parts (fewer only when the text is too short to divide that far). Given the
 * same text and `n`, the split is deterministic.
 */
export function splitIntoParts(text: string, n: number): string[] {
  const clean = text.trim();
  if (n <= 1 || !clean) return [clean];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  let tokens = paragraphs;
  let joiner = "\n\n";

  // Not enough paragraphs to fill `n` panels: divide into sentences instead.
  if (tokens.length < n) {
    const sentences = clean
      .split(/(?<=[.!?…])\s+(?=\S)/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length > tokens.length) {
      tokens = sentences;
      joiner = " ";
    }
  }

  const parts = Math.min(n, tokens.length);
  if (parts <= 1) return [clean];

  const groups: string[] = [];
  for (let i = 0; i < parts; i++) {
    const start = Math.floor((i * tokens.length) / parts);
    const end = Math.floor(((i + 1) * tokens.length) / parts);
    const group = tokens.slice(start, end).join(joiner).trim();
    if (group) groups.push(group);
  }
  return groups.length > 0 ? groups : [clean];
}
