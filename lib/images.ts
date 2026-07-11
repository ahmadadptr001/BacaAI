import "server-only";

/**
 * Finds an ANIMATION/illustration-style image for a chapter (the story AI is
 * text-only). Returns null on any failure so chapter generation never breaks
 * just because an image couldn't be found.
 *
 * Default source — Pollinations: a keyless AI image generator. Because it
 * *generates* from the scene text, the picture is always on-topic and we force
 * an anime/illustration look. The URL is deterministic (seeded by the scene)
 * and rendered lazily by the browser, so generation adds no server latency.
 * This is what makes results look like comic art instead of stock photos.
 *
 * Set IMAGE_SOURCE=search to instead use real web images (Openverse
 * illustrations → Wikimedia), scored by how many query words match.
 */

// "generate" (default, anime AI art) | "search" (web image search)
const IMAGE_SOURCE = (process.env.IMAGE_SOURCE ?? "generate").toLowerCase();

const GEN_WIDTH = 768;
const GEN_HEIGHT = 512;

/** Stable positive integer seed from a string, so the same scene → same art. */
function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build a deterministic Pollinations URL that renders the scene as anime art. */
function pollinationsUrl(scene: string): string {
  const prompt = `anime illustration, cinematic lighting, detailed, ${scene}`;
  const params = new URLSearchParams({
    width: String(GEN_WIDTH),
    height: String(GEN_HEIGHT),
    nologo: "true",
    model: "flux",
    seed: String(seedFrom(scene)),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?${params.toString()}`;
}


const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "and", "with", "to", "for",
  "from", "by", "into", "over", "under", "near", "this", "that", "is",
  "are", "scene", "photo", "image", "picture", "view",
]);

/** Meaningful lowercase terms from a query (drops stopwords + tiny words). */
function terms(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Query variants from most specific to most general (deduped). */
function queryVariants(q: string): string[] {
  const words = terms(q);
  const variants = new Set<string>();
  if (q.trim()) variants.add(q.trim());
  if (words.length > 3) variants.add(words.slice(0, 3).join(" "));
  if (words.length > 1) variants.add(words.slice(0, 2).join(" "));
  if (words.length >= 1) variants.add(words[0]);
  return [...variants].filter(Boolean);
}

type Candidate = { src: string; score: number };

/** How many of the query terms appear in a result's text (title + tags). */
function relevanceScore(text: string, wanted: string[]): number {
  const hay = text.toLowerCase();
  let s = 0;
  for (const w of wanted) if (hay.includes(w)) s++;
  return s;
}

/** fetch JSON, honoring the caller's abort signal plus a per-request timeout. */
async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(7000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetch(url, {
    signal: combined,
    headers: { "User-Agent": "BacaAi/1.0 (interactive comics)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchOpenverse(
  q: string,
  wanted: string[],
  signal?: AbortSignal
): Promise<Candidate | null> {
  // Drawn/animation-style art first (illustration → digitized artwork), then
  // fall back to any image type. This biases results toward a comic look
  // instead of real photographs.
  for (const category of ["illustration", "digitized_artwork", ""]) {
    const params = new URLSearchParams({
      q,
      page_size: "12",
      mature: "false",
    });
    if (category) params.set("category", category);

    let data: {
      results?: Array<{
        url?: string;
        thumbnail?: string;
        title?: string;
        tags?: Array<{ name?: string }>;
      }>;
    };
    try {
      data = (await fetchJson(
        "https://api.openverse.org/v1/images/?" + params.toString(),
        signal
      )) as typeof data;
    } catch {
      continue;
    }

    let best: Candidate | null = null;
    for (const r of data.results ?? []) {
      const src = r.thumbnail ?? r.url;
      if (!src) continue;
      const text = `${r.title ?? ""} ${(r.tags ?? [])
        .map((t) => t.name ?? "")
        .join(" ")}`;
      const score = relevanceScore(text, wanted);
      if (!best || score > best.score) best = { src, score };
    }
    if (best) return best;
  }
  return null;
}

async function searchWikimedia(
  q: string,
  wanted: string[],
  signal?: AbortSignal
): Promise<Candidate | null> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: "6", // File: namespace
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "800",
    format: "json",
    origin: "*",
  });

  let data: {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{ thumburl?: string; url?: string }>;
        }
      >;
    };
  };
  try {
    data = (await fetchJson(
      "https://commons.wikimedia.org/w/api.php?" + params.toString(),
      signal
    )) as typeof data;
  } catch {
    return null;
  }

  let best: Candidate | null = null;
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const src = info?.thumburl ?? info?.url;
    if (!src) continue;
    // Skip obvious non-photos that slip through (svg/maps/logos).
    if (/\.svg(\?|$)/i.test(src)) continue;
    const score = relevanceScore(page.title ?? "", wanted);
    if (!best || score > best.score) best = { src, score };
  }
  return best;
}

export async function searchImage(
  query: string,
  signal?: AbortSignal
): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  // Default: on-topic anime-style art, generated from the scene. Deterministic
  // URL rendered lazily by the browser — no server-side fetch, no latency.
  if (IMAGE_SOURCE !== "search") {
    return pollinationsUrl(q);
  }

  // IMAGE_SOURCE=search: real web images instead.
  const wanted = terms(q);
  const variants = queryVariants(q);
  // Weakly-relevant fallback: the best on-topic hit we saw, even if it only
  // matched loosely. Better a related photo than a blank chapter.
  let weakest: Candidate | null = null;

  for (const variant of variants) {
    const found =
      (await searchOpenverse(variant, wanted, signal)) ??
      (await searchWikimedia(variant, wanted, signal));
    if (!found) continue;

    // A real term match on the full/specific variants — good enough, use it.
    if (found.score > 0) return found.src;
    if (!weakest) weakest = found;
  }

  return weakest?.src ?? null;
}
