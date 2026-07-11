import { SpeechIcon, SparkleIcon } from "@/components/icons";

/**
 * Renders a chapter's text with a bit of flair instead of a wall of identical
 * paragraphs: a drop-cap opening, dialogue lines styled as speech blocks, and
 * scene-break ornaments. Emoji the AI includes just render inline.
 */

// A paragraph that is only a divider marker (the AI may separate scenes).
const SCENE_BREAK = /^(\*{2,}|-{3,}|—{2,}|•{2,}|~{2,}|=+|⁂)$/;

// Opens like speech: a quote char or an em-dash lead-in.
function isDialogue(p: string): boolean {
  return /^["“”'‘’«»„]/.test(p) || /^[—–]\s/.test(p);
}

function SceneBreak() {
  return (
    <div
      className="flex items-center justify-center gap-3 py-2 text-brand-400"
      aria-hidden="true"
    >
      <span className="h-px w-12 bg-border" />
      <SparkleIcon className="h-4 w-4" />
      <span className="h-px w-12 bg-border" />
    </div>
  );
}

export default function ChapterProse({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  // The first ordinary paragraph (not a scene break, not dialogue) gets the
  // decorative drop cap. Precomputed so render stays free of mutation.
  const dropCapIndex = blocks.findIndex(
    (b) => !SCENE_BREAK.test(b) && !isDialogue(b)
  );

  return (
    <div className="mt-5 space-y-4 text-[1.05rem] leading-[1.9] text-foreground/90">
      {blocks.map((block, i) => {
        if (SCENE_BREAK.test(block)) return <SceneBreak key={i} />;

        if (isDialogue(block)) {
          return (
            <p
              key={i}
              className="flex gap-2.5 rounded-r-xl border-l-4 border-brand-400 bg-brand-50/70 px-4 py-3 font-medium italic text-foreground dark:bg-brand-600/10"
            >
              <SpeechIcon className="mt-1 h-4 w-4 shrink-0 text-brand-500" />
              <span>{block}</span>
            </p>
          );
        }

        const dropCap = i === dropCapIndex;
        return (
          <p
            key={i}
            className={
              dropCap
                ? "first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-5xl first-letter:font-black first-letter:leading-[0.75] first-letter:text-brand-600 dark:first-letter:text-brand-400"
                : undefined
            }
          >
            {block}
          </p>
        );
      })}
    </div>
  );
}
