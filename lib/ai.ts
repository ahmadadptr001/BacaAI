import "server-only";
import OpenAI from "openai";
import type { CastMember, Chapter, Choice, Comic } from "./types";

/**
 * AI integration for generating comic chapters.
 *
 * Uses an OpenAI-compatible chat endpoint (default: NVIDIA's hosted Nemotron
 * via https://integrate.api.nvidia.com/v1). Configure via env:
 *   AI_API_KEY   required — API key for the provider
 *   AI_BASE_URL  default https://integrate.api.nvidia.com/v1
 *   AI_MODEL     default nvidia/nemotron-3-ultra-550b-a55b
 *
 * The model is a TEXT model — it does not create images. To keep the AI from
 * losing the thread, every prompt includes the story so far (a bounded window
 * of chapters on the reader's path, in order). For artwork we ask the model for
 * an English search phrase, which the caller uses to fetch a real photo from
 * the web (see lib/images.ts).
 */

const AI_API_KEY = process.env.AI_API_KEY ?? process.env.NVIDIA_API_KEY ?? "";
const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const AI_MODEL =
  process.env.AI_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b";

const client = new OpenAI({
  apiKey: AI_API_KEY,
  baseURL: AI_BASE_URL,
  // Generation can take a while on large models; be generous but bounded.
  timeout: 120_000,
});

/** The chapters on the reader's path, from the opening chapter to the latest. */
export type StorySoFar = Array<
  Pick<Chapter, "chapter_number" | "title" | "content_text">
>;

export interface GeneratedChapter {
  title: string;
  content_text: string;
  choices: string[];
  /** English keywords for finding a fitting photo, or null. */
  image_query: string | null;
}

export interface GenerateInput {
  comic: Pick<Comic, "title" | "description">;
  history: StorySoFar;
  choice: Pick<Choice, "description">;
}

function renderStory(history: StorySoFar): string {
  const parts: string[] = [];
  let prevNum: number | null = null;
  for (const c of history) {
    // Signal when chapters were skipped (context window trims the middle).
    if (prevNum !== null && c.chapter_number > prevNum + 1) {
      parts.push("(…beberapa bab di antara dilewati demi keringkasan…)");
    }
    parts.push(`--- BAB ${c.chapter_number}: ${c.title} ---\n${c.content_text}`);
    prevNum = c.chapter_number;
  }
  return parts.join("\n\n");
}

const PERSONA = `Kamu adalah asisten penulis untuk sebuah komik bercabang (pembaca usia 15-25).
Pengguna berperan sebagai PENULIS yang menentukan ARAH ALUR cerita, bukan sebagai
tokoh di dalamnya. Jadi setiap opsi ditulis sebagai arah/kelanjutan alur dari
sudut pandang naratif (mis. "Perlihatkan masa lalu sang tokoh", "Bawa kisah ke
konfrontasi di atap kota"), BUKAN perintah orang kedua seperti "Kamu membuka pintu".
Nada ceritanya ramah, penuh petualangan, dan hidup. Tulis SEMUA teks dalam
Bahasa Indonesia yang natural. JANGAN gunakan tanda pisah em-dash ("—" atau
" - ") di dalam kalimat; pakai koma, titik, atau pecah jadi kalimat baru.

Jaga KONSISTENSI tokoh utama dan alur inti (nama, sifat, hubungan, kejadian
penting). NAMUN jangan monoton: kembangkan cerita ke situasi dan latar yang
baru, dan hadirkan tokoh atau elemen BARU bila terasa wajar. HINDARI memunculkan
tokoh sampingan yang sama berulang-ulang, mengulang nama yang itu-itu saja, atau
mendaur ulang adegan/konflik yang mirip. Setiap bab harus terasa segar dan
MEMAJUKAN cerita, bukan berputar di tempat.`;

function buildPrompt({ comic, history, choice }: GenerateInput, panels: number): string {
  // The chapter will be split into `panels` illustrated parts, so scale the
  // length with it (~2 paragraphs per part) — otherwise more images just means
  // less text per image. Extra length must add DEPTH, not a bigger plot jump.
  const minPara = panels <= 1 ? 3 : panels * 2;
  const maxPara = panels <= 1 ? 5 : panels * 2 + 2;
  const lengthNote =
    panels <= 1
      ? `Buat ${minPara}-${maxPara} paragraf NARASI yang berbobot (tiap paragraf narasi 3-5 kalimat utuh) dan MEMAJUKAN cerita.`
      : `Bab ini akan dibagi menjadi ${panels} bagian bergambar, jadi tulis LEBIH PANJANG: ${minPara}-${maxPara} paragraf NARASI, dengan bobot MERATA sepanjang bab (kira-kira 2 paragraf untuk tiap bagian) supaya tiap gambar punya cukup teks. Tiap paragraf narasi WAJIB berisi 3-5 kalimat utuh — makin banyak paragraf, makin banyak KALIMAT. Tambahkan KEDALAMAN, dialog, dan detail adegan, BUKAN lompatan waktu/tempat.`;
  return `${PERSONA}

KOMIK: "${comic.title}"
PREMIS: ${comic.description ?? "(tidak ada)"}

CERITA SEJAUH INI (urut dari awal, JANGAN diulang):
${renderStory(history)}

Sebagai penulis, arah alur yang dipilih untuk kelanjutan kisah:
"${choice.description}"

Tulis BAB BERIKUTNYA yang mengembangkan arah tersebut dan konsisten dengan
seluruh cerita di atas. ${lengthNote}

KESINAMBUNGAN (WAJIB, jangan dilanggar):
- Bab ini harus MENYAMBUNG LANGSUNG dari akhir bab sebelumnya. Mulai dari
  situasi, tempat, dan waktu persis di mana cerita tadi berhenti.
- Ikuti arah yang dipilih di atas SEBAGAI INTI bab ini, bukan sekadar disenggol.
- JANGAN melompat terlalu jauh: hindari lompatan waktu besar (mis. "bertahun-tahun
  kemudian"), perpindahan tempat/adegan mendadak tanpa transisi, atau
  memperkenalkan konflik/tokoh besar yang muncul entah dari mana. Satu bab =
  satu langkah kecil yang masuk akal ke depan.
- Hormati fakta yang sudah ada (siapa hadir, luka/kondisi, benda yang dibawa,
  hubungan antar tokoh). Jangan menghidupkan yang sudah tiada atau melupakan
  kejadian penting.

Gaya penulisan (WAJIB, agar tidak membosankan):
- Setiap paragraf NARASI WAJIB berisi minimal 3-5 kalimat yang utuh dan
  berbobot. DILARANG KERAS ada paragraf narasi yang cuma beberapa kata atau satu
  klausa pendek. Perbanyak panjang dengan menambah KALIMAT di dalam paragraf,
  BUKAN dengan memecah-mecah teks jadi banyak paragraf pendek.
- WAJIB ada PERCAKAPAN antar tokoh. Tulis SETIAP baris dialog sebagai paragraf
  TERSENDIRI yang diawali tanda kutip ganda, mis:
  "Kau tak seharusnya ada di sini," bisik Rin.
  (Baris dialog boleh pendek — pengecualian dari aturan panjang paragraf di atas.)
- Variasikan ritme: campur kalimat pendek yang menegangkan dengan kalimat
  deskriptif yang mengalir.
- Bubuhkan sedikit emoji yang relevan sesekali (mis. ⚔️ 🔥 ✨ 🌙) untuk memberi
  rasa — secukupnya, JANGAN berlebihan atau di tiap kalimat.
- Pisahkan setiap paragraf dengan BARIS KOSONG (dua baris baru).

Lalu tawarkan tepat dua ARAH ALUR baru yang berbeda untuk kelanjutan cerita
(tulis sebagai arah naratif, bukan perintah "kamu melakukan X").

Terakhir, "image_query": deskripsi SATU adegan konkret dari bab ini dalam
Bahasa Inggris, 4-8 kata, yang bisa digambar — sebutkan LATAR/TEMPAT + SUBJEK
utama + suasana/waktu (mis. "neon city alley at night", "lighthouse on rocky
coast at dawn", "crowded night market street"). Pakai kata benda konkret;
JANGAN pakai kata abstrak/emosi ("mystery", "tension", "hope"), JANGAN sertakan
nama tokoh atau nama tempat fiktif. (Gaya animasi akan ditambahkan otomatis.)

Balas HANYA dengan JSON valid, tanpa markdown, persis dalam bentuk ini:
{
  "title": "Judul bab (jangan sertakan nomor)",
  "content_text": "Naskah bab.",
  "choices": ["pilihan pertama", "pilihan kedua"],
  "image_query": "english search phrase"
}`;
}

function buildChoicesPrompt(
  comic: GenerateInput["comic"],
  history: StorySoFar
): string {
  return `${PERSONA}

KOMIK: "${comic.title}"
PREMIS: ${comic.description ?? "(tidak ada)"}

CERITA SEJAUH INI (urut dari awal):
${renderStory(history)}

Berdasarkan keseluruhan cerita di atas, tawarkan tepat dua ARAH ALUR berbeda dan
menarik yang bisa dipilih penulis untuk kelanjutan kisah. Tulis sebagai arah
naratif singkat (bukan perintah "kamu melakukan X"), maksimal ~12 kata per opsi.

Balas HANYA dengan JSON valid, tanpa markdown, persis dalam bentuk ini:
{ "choices": ["pilihan pertama", "pilihan kedua"] }`;
}

/** Best-effort extraction of a JSON object from a model's raw text response. */
function parseModelJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model response contained no JSON object");
  }
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

/** Trimmed string from an unknown field, or a fallback. */
function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const cleaned = value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    if (cleaned.length) return cleaned;
  }
  return fallback;
}

async function callModel(prompt: string, signal?: AbortSignal): Promise<string> {
  const completion = await client.chat.completions.create(
    {
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Kamu membalas HANYA dengan satu objek JSON valid, tanpa teks lain dan tanpa markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 4096,
      // Nemotron reasoning toggle: keep chain-of-thought OFF so the reply is
      // clean JSON (and much faster / cheaper). Ignored by non-Nemotron models.
      // @ts-expect-error provider-specific extra body param, not in OpenAI types
      chat_template_kwargs: { enable_thinking: false },
    },
    { signal }
  );

  return completion.choices[0]?.message?.content ?? "";
}

/**
 * Generates just the two decision-point options for the latest chapter, given
 * the story so far. Used when a chapter has no options yet (e.g. the opening
 * chapter an admin wrote).
 */
export async function generateChoices(
  comic: GenerateInput["comic"],
  history: StorySoFar,
  signal?: AbortSignal
): Promise<string[]> {
  const raw = await callModel(buildChoicesPrompt(comic, history), signal);
  const parsed = parseModelJson(raw);
  return toStringArray(parsed.choices, [
    "Percepat konflik utamanya",
    "Dalami suasana dan tokohnya dulu",
  ]);
}

/**
 * Calls the model and returns a normalized next chapter. `imageCount` is how
 * many illustrated parts the chapter will be split into; the chapter length
 * scales with it so each panel gets enough text. Throws on network failure or
 * unparseable output so callers can show a friendly error.
 */
export async function generateNextChapter(
  input: GenerateInput,
  imageCount = 1,
  signal?: AbortSignal
): Promise<GeneratedChapter> {
  const panels = Math.max(1, Math.floor(imageCount) || 1);
  const raw = await callModel(buildPrompt(input, panels), signal);
  const parsed = parseModelJson(raw);

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : "Cerita Berlanjut",
    content_text:
      typeof parsed.content_text === "string" && parsed.content_text.trim()
        ? parsed.content_text.trim()
        : "Jalan di depan tampak kabur... (sang pencerita kehabisan kata).",
    choices: toStringArray(parsed.choices, [
      "Percepat konflik utamanya",
      "Dalami suasana dan tokohnya dulu",
    ]),
    image_query:
      typeof parsed.image_query === "string" && parsed.image_query.trim()
        ? parsed.image_query.trim()
        : null,
  };
}

/** One panel: an English scene + which cast members (by name) appear in it. */
export interface ChapterArtPanel {
  scene: string;
  characters: string[];
}

/** The art plan for a chapter: any newly introduced cast + the per-part panels. */
export interface ChapterArtPlan {
  newCharacters: CastMember[];
  panels: ChapterArtPanel[];
}

function buildArtPlanPrompt(
  comic: Pick<Comic, "title" | "description">,
  chapterTitle: string,
  parts: string[],
  cast: CastMember[]
): string {
  const n = parts.length;
  const listed = parts.map((p, i) => `[BAGIAN ${i + 1}]\n${p}`).join("\n\n");
  const locked =
    cast.length > 0
      ? cast.map((c) => `- ${c.name}: ${c.brief}`).join("\n")
      : "(belum ada)";
  return `${PERSONA}

Kamu menyiapkan STORYBOARD sekaligus menjaga KONSISTENSI KARAKTER untuk ilustrasi
SATU bab komik. Bab ini dibagi menjadi ${n} BAGIAN berurutan sesuai alur.

KARAKTER YANG SUDAH DIKUNCI (penampilan TIDAK BOLEH diubah, pakai apa adanya):
${locked}

Kerjakan DUA hal:
1) "new_characters": untuk SETIAP karakter yang MUNCUL di bab ini tetapi BELUM ada
   di daftar terkunci di atas, tetapkan penampilan visual TETAP-nya. Tiap entri:
   { "name": "<nama persis seperti di cerita>", "brief": "<deskripsi Inggris
   konkret: jenis kelamin+usia, warna & gaya rambut, warna mata, ciri wajah,
   postur tubuh, pakaian/atribut>" }. JANGAN masukkan karakter yang sudah
   terkunci. Jika tak ada yang baru, kembalikan [].
2) "panels": TEPAT ${n} item, berurutan sesuai bagian. Tiap item:
   - "scene": Bahasa Inggris 6-12 kata tentang AKSI + LATAR/TEMPAT + suasana pada
     bagian itu. JANGAN mendeskripsikan penampilan karakter (diambil dari daftar).
     Boleh berupa pemandangan tanpa tokoh jika bagian itu memang tanpa karakter.
   - "characters": daftar NAMA karakter yang benar-benar tampak di bagian itu
     (HARUS cocok dengan nama di daftar terkunci atau di new_characters). Pakai []
     bila tak ada tokoh.

KOMIK: "${comic.title}"
BAB: "${chapterTitle}"

${listed}

Balas HANYA dengan JSON valid, tanpa markdown, persis dalam bentuk ini:
{ "new_characters": [{ "name": "...", "brief": "..." }],
  "panels": [{ "scene": "...", "characters": ["..."] }] }
"panels" WAJIB berisi TEPAT ${n} item berurutan.`;
}

function toCast(value: unknown): CastMember[] {
  if (!Array.isArray(value)) return [];
  const out: CastMember[] = [];
  for (const v of value) {
    if (v && typeof v === "object") {
      const name = toText((v as Record<string, unknown>).name);
      const brief = toText((v as Record<string, unknown>).brief);
      if (name && brief) out.push({ name, brief });
    }
  }
  return out;
}

/**
 * Plan a chapter's artwork with cast consistency. Given the chapter split into
 * ordered `parts` and the comic's already-locked `cast`, the model returns:
 *  - `newCharacters`: fixed looks for any character appearing here for the first
 *    time (existing cast is passed in and must NOT be re-described), and
 *  - `panels`: one scene per part plus the names of the characters in it.
 * The caller prepends each named character's locked brief to the scene, so every
 * character keeps the same look across panels and chapters. Panels are aligned
 * to exactly `parts.length`.
 */
export async function planChapterArt(
  comic: Pick<Comic, "title" | "description">,
  chapterTitle: string,
  parts: string[],
  cast: CastMember[],
  signal?: AbortSignal
): Promise<ChapterArtPlan> {
  if (parts.length === 0) return { newCharacters: [], panels: [] };
  const raw = await callModel(
    buildArtPlanPrompt(comic, chapterTitle, parts, cast),
    signal
  );
  const parsed = parseModelJson(raw);

  const newCharacters = toCast(parsed.new_characters);

  const rawPanels = Array.isArray(parsed.panels) ? parsed.panels : [];
  const panels: ChapterArtPanel[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = rawPanels[i] as Record<string, unknown> | undefined;
    const scene = p ? toText(p.scene) : "";
    const characters = Array.isArray(p?.characters)
      ? (p!.characters as unknown[])
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim())
          .filter(Boolean)
      : [];
    panels.push({
      scene: scene || "cinematic anime scene",
      characters,
    });
  }

  return { newCharacters, panels };
}

/** An AI-drafted comic to pre-fill the admin's "add comic" form. */
export interface SuggestedComic {
  title: string;
  description: string;
  story: string;
  /** English scene phrase for the cover image, or null. */
  image_query: string | null;
}

function buildSuggestPrompt(seed: { title?: string; hint?: string }): string {
  const title = seed.title?.trim();
  const hint = seed.hint?.trim();
  return `${PERSONA}

Bantu seorang admin membuat KOMIK INTERAKTIF BARU yang terasa seperti MANHWA/
MANGA/ANIME atau DONGHUA fantasi untuk pembaca usia 15-25. Rasakan pola khas
Jepang atau China (pilih SALAH SATU latar budaya lalu konsisten):
- Jepang: dunia isekai/akademi penyihir/pemburu dungeon/roh & yokai, "sistem"
  status & level, pedang & sihir. Nama tokoh khas Jepang (mis. Haruki, Rin,
  Kaede, Sora, Akira, Yuna).
- China (xianxia/wuxia/murim): kultivasi & qi, sekte & klan, dunia persilatan,
  balas dendam & kebangkitan. Nama tokoh khas China (mis. Li Wei, Mu Yan,
  Chen Feng, Bai Ling, Xiao Yun).
Pakai trope populer manhwa (mis. karakter yang bereinkarnasi/regresi, si lemah
yang bangkit, kontrak dengan makhluk kuat) tapi olah agar SEGAR, jangan basi.
${
  title
    ? `Judul yang diinginkan: "${title}" (boleh dirapikan, pertahankan intinya).`
    : "Buatkan juga judul yang menarik & orisinal bergaya manhwa/anime (2-5 kata)."
}
${
  hint
    ? `Ide/arahan dari admin: ${hint} (tetap balut dalam gaya manhwa/anime di atas).`
    : "Bebas pilih latar Jepang atau China dan ciptakan premis yang segar."
}

Hasilkan empat bagian:
1. "title": judul bergaya manhwa/anime (boleh dramatis).
2. "description": sinopsis yang menggoda, 1-2 kalimat (maks ~40 kata), sebutkan
   nama tokoh utama, tanpa membocorkan ending.
3. "story": naskah BAB 1 sebagai pembuka yang hidup (3-5 paragraf) yang
   memperkenalkan tokoh utama BESERTA NAMANYA, dunia & sistem kekuatannya, dan
   konflik/misteri awal — dengan tempo dan nuansa khas manhwa/anime. WAJIB ada
   percakapan: tulis tiap baris dialog sebagai paragraf tersendiri diawali tanda
   kutip ("..."). Variasikan ritme kalimat dan bubuhkan sedikit emoji relevan
   (⚔️🔥✨🌙) secukupnya. Pisahkan tiap paragraf dengan baris kosong. JANGAN
   akhiri dengan pertanyaan atau daftar pilihan — cukup naskah ceritanya.
4. "image_query": deskripsi SATU adegan SAMPUL dalam Bahasa Inggris, 4-8 kata,
   yang bisa digambar — sebutkan tokoh utama + latar/suasana (mis. "young
   swordsman in glowing dungeon", "girl mage on floating temple at dusk").
   Kata benda konkret, tanpa nama tokoh/tempat fiktif. Gaya animasi otomatis.

Tulis SEMUA narasi dalam Bahasa Indonesia yang natural (nama tokoh & istilah
khas boleh tetap dalam ejaan aslinya).

Balas HANYA dengan JSON valid, tanpa markdown, persis dalam bentuk ini:
{ "title": "...", "description": "...", "story": "...", "image_query": "..." }`;
}

/**
 * Drafts a synopsis + opening chapter (Bab 1) for a new comic, seeded by
 * whatever the admin has typed (a title and/or a rough idea). Used by the
 * admin "add comic" form's AI-recommendation button.
 */
export async function suggestComic(
  seed: { title?: string; hint?: string },
  signal?: AbortSignal
): Promise<SuggestedComic> {
  const raw = await callModel(buildSuggestPrompt(seed), signal);
  const parsed = parseModelJson(raw);
  return {
    title: toText(parsed.title, seed.title?.trim() ?? "Komik Tanpa Judul"),
    description: toText(parsed.description),
    story: toText(parsed.story),
    image_query: toText(parsed.image_query) || null,
  };
}
