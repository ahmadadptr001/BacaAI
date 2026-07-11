"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectChoice, writeOwnDirection } from "@/app/actions/reading";
import Spinner from "@/components/Spinner";
import { PenIcon } from "@/components/icons";
import type { Choice } from "@/lib/types";

const MAX_LEN = 300;

/**
 * The decision point. Readers can pick one of the AI's preset directions, or
 * open the writer box to type their OWN direction. Either way it records the
 * choice + kicks off AI generation via a Server Action, shows a loading state,
 * then refreshes to reveal the next chapter.
 */
export default function ChoiceButtons({
  comicId,
  chapterId,
  choices,
  isAuthed,
}: {
  comicId: string;
  chapterId: string;
  choices: Choice[];
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [custom, setCustom] = useState("");

  function requireAuth(): boolean {
    if (isAuthed) return true;
    router.push(`/login?redirectTo=/comics/${comicId}`);
    return false;
  }

  function advance(
    run: () => Promise<{ ok: boolean; error?: string }>,
    active: string
  ) {
    setError(null);
    setActiveId(active);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setError(result.error ?? "Terjadi kesalahan. Silakan coba lagi.");
        setActiveId(null);
        return;
      }
      // Reset the writer box so the next chapter starts with a blank field.
      setWriting(false);
      setCustom("");
      router.push(`/comics/${comicId}`);
      router.refresh();
    });
  }

  function choose(choiceId: string) {
    if (!requireAuth()) return;
    advance(() => selectChoice(comicId, choiceId), choiceId);
  }

  function submitCustom() {
    if (!requireAuth()) return;
    if (custom.trim().length < 3) {
      setError("Tulis dulu arah cerita yang kamu inginkan.");
      return;
    }
    advance(() => writeOwnDirection(comicId, chapterId, custom), "__custom__");
  }

  return (
    <div className="flex flex-col gap-3">
      {choices.map((choice) => {
        const isActive = activeId === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => choose(choice.id)}
            disabled={isPending}
            aria-label={`Bawa cerita ke arah: ${choice.description}`}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-brand-400/40 bg-background px-5 py-4 text-center font-medium transition-all hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-brand-600/20"
          >
            {isActive && isPending ? (
              <Spinner label="Menyusun bab berikutnya" />
            ) : (
              choice.description
            )}
          </button>
        );
      })}

      {/* Write-your-own direction */}
      {!writing ? (
        <button
          type="button"
          onClick={() => {
            if (!requireAuth()) return;
            setWriting(true);
          }}
          disabled={isPending}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-5 py-3 text-sm font-medium text-muted transition-colors hover:border-brand-400 hover:text-brand-600 disabled:opacity-60 dark:hover:text-brand-400"
        >
          <PenIcon width={16} height={16} />
          Tulis arah ceritamu sendiri
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-brand-400/40 bg-background p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400">
            <PenIcon width={16} height={16} />
            Arah ceritamu
          </label>
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, MAX_LEN))}
            rows={3}
            autoFocus
            disabled={isPending}
            placeholder="Mis. Sang tokoh utama menemukan gerbang rahasia di bawah kuil…"
            className="resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/40"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              {custom.length}/{MAX_LEN}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setWriting(false);
                  setCustom("");
                  setError(null);
                }}
                disabled={isPending}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitCustom}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {activeId === "__custom__" && isPending ? (
                  <Spinner label="Menulis bab" />
                ) : (
                  "Tulis babnya"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAuthed && (
        <p className="text-center text-sm text-muted">
          Masuk untuk menentukan arah cerita dan menyimpan kisahmu.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-accent-500/10 p-3 text-center text-sm text-accent-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}
