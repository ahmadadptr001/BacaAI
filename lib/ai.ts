import "server-only";
import OpenAI from "openai";
import type { Chapter, Choice, Comic } from "./types";

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

function buildPrompt({ comic, history, choice }: GenerateInput): string {
  return `${PERSONA}

KOMIK: "${comic.title}"
PREMIS: ${comic.description ?? "(tidak ada)"}

CERITA SEJAUH INI (urut dari awal, JANGAN diulang):
${renderStory(history)}

Sebagai penulis, arah alur yang dipilih untuk kelanjutan kisah:
"${choice.description}"

Tulis BAB BERIKUTNYA yang mengembangkan arah tersebut dan konsisten dengan
seluruh cerita di atas. Buat 3-5 paragraf yang hidup dan MEMAJUKAN cerita.

Gaya penulisan (WAJIB, agar tidak membosankan):
- WAJIB ada PERCAKAPAN antar tokoh. Tulis SETIAP baris dialog sebagai paragraf
  TERSENDIRI yang diawali tanda kutip ganda, mis:
  "Kau tak seharusnya ada di sini," bisik Rin.
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
 * Calls the model and returns a normalized next chapter. Throws on network
 * failure or unparseable output so callers can show a friendly error.
 */
export async function generateNextChapter(
  input: GenerateInput,
  signal?: AbortSignal
): Promise<GeneratedChapter> {
  const raw = await callModel(buildPrompt(input), signal);
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

function buildScenesPrompt(
  comic: Pick<Comic, "title" | "description">,
  chapterTitle: string,
  parts: string[],
  characterBrief: string
): string {
  const n = parts.length;
  const listed = parts
    .map((p, i) => `[BAGIAN ${i + 1}]\n${p}`)
    .join("\n\n");
  const shape = parts.map(() => `"english scene phrase"`).join(", ");
  return `${PERSONA}

Kamu membuat STORYBOARD gambar untuk SATU bab komik. Bab ini sudah dibagi
menjadi ${n} BAGIAN berurutan sesuai alur cerita. Untuk SETIAP bagian, buat satu
"image_query": deskripsi adegan visual PALING KUNCI dari bagian itu, dalam
Bahasa Inggris, 6-12 kata. Fokus pada AKSI/POSISI tokoh + LATAR/TEMPAT +
suasana/waktu (mis. "swordsman kneeling in a burning shrine at night",
"girl running across a rooftop under heavy rain"). Pakai kata benda konkret;
JANGAN pakai kata abstrak/emosi ("mystery", "tension", "hope"); JANGAN sertakan
nama tokoh atau nama tempat fiktif. (Gaya animasi ditambahkan otomatis.)

TOKOH UTAMA (penampilan TETAP): ${characterBrief || "(sesuai cerita, jaga konsisten)"}.
JANGAN mendeskripsikan ulang wajah/rambut/pakaian/jenis kelamin tokoh dalam
query — penampilan itu ditambahkan otomatis agar SAMA di setiap gambar. Cukup
tuliskan apa yang tokoh LAKUKAN dan DI MANA. Jika sebuah bagian tidak
menampilkan tokoh utama, buat query LATAR/pemandangan saja.

SANGAT PENTING: query ke-i HARUS benar-benar menggambarkan isi BAGIAN ke-i itu
sendiri (bukan bagian lain), sehingga urutan gambar mengikuti persis alur cerita
bab ini dari awal sampai akhir.

KOMIK: "${comic.title}"
BAB: "${chapterTitle}"

${listed}

Balas HANYA dengan JSON valid, tanpa markdown, persis dalam bentuk ini:
{ "queries": [${shape}] }
dengan TEPAT ${n} item, berurutan sesuai bagian di atas.`;
}

/**
 * For a chapter split into ordered `parts`, returns one English image query per
 * part — each describing the key visual of THAT part, so a sequence of images
 * tracks the chapter's flow. `characterBrief` is the main character's fixed
 * look; scenes describe the character's action while the appearance itself is
 * prepended by the caller (keeping it identical across panels/chapters). Always
 * returns exactly `parts.length` queries (padding a short reply).
 */
export async function describeChapterScenes(
  comic: Pick<Comic, "title" | "description">,
  chapterTitle: string,
  parts: string[],
  characterBrief: string,
  signal?: AbortSignal
): Promise<string[]> {
  if (parts.length === 0) return [];
  const raw = await callModel(
    buildScenesPrompt(comic, chapterTitle, parts, characterBrief),
    signal
  );
  const parsed = parseModelJson(raw);
  const queries = toStringArray(parsed.queries, []);

  // Align to exactly one query per part. If the model returned too few, reuse
  // the last good one (a repeat beats a missing panel).
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    out.push(
      queries[i] ??
        queries[queries.length - 1] ??
        "dramatic cinematic anime scene"
    );
  }
  return out;
}

/**
 * Establish the main character's FIXED visual look from the opening chapter, so
 * every illustration can render the same person (same gender, hair, face,
 * build, outfit). Returns a concise English description with no name/setting,
 * or "" if the model can't produce one. Generated once per comic and cached.
 */
export async function describeMainCharacters(
  comic: Pick<Comic, "title" | "description">,
  openingStory: string,
  signal?: AbortSignal
): Promise<string> {
  const prompt = `${PERSONA}

Dari naskah pembuka berikut, TETAPKAN penampilan visual TETAP untuk TOKOH UTAMA,
agar bisa dipakai ulang di semua ilustrasi bab (supaya wajah & sosoknya
konsisten). Tulis dalam Bahasa Inggris sebagai SATU frasa deskriptif ringkas
(maks ~30 kata). WAJIB sebutkan secara konkret dan spesifik:
- jenis kelamin dan perkiraan usia (mis. "teenage boy ~17", "young woman ~20"),
- warna dan gaya rambut (mis. "short messy black hair", "long silver braid"),
- warna mata dan ciri wajah,
- bentuk/postur tubuh (mis. "lean athletic", "petite"),
- pakaian & atribut khas (mis. "dark hooded cloak, silver longsword").
Pakai atribut visual konkret. TANPA nama tokoh, TANPA latar, TANPA aksi. Jika
naskah tidak menyebut detail, TENTUKAN sendiri yang masuk akal lalu kunci.

KOMIK: "${comic.title}"
PREMIS: ${comic.description ?? "(tidak ada)"}

NASKAH PEMBUKA:
${openingStory}

Balas HANYA dengan JSON valid, tanpa markdown, persis:
{ "character": "english visual description" }`;
  const raw = await callModel(prompt, signal);
  const parsed = parseModelJson(raw);
  return toText(parsed.character);
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
