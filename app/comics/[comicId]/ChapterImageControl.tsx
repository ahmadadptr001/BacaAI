"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setChapterImages } from "@/app/actions/reading";
import { ImageIcon } from "@/components/icons";

/**
 * Per-chapter setting: choose how many panel images this chapter should have
 * (1..max — 4 for readers, 6 for admins). Picking a number splits the chapter
 * into that many parts and generates an image matching each part's flow. Shows
 * a blocking loading screen while the AI draws, then refreshes to reveal them.
 */
export default function ChapterImageControl({
  comicId,
  chapterId,
  current,
  max,
  isAdmin,
}: {
  comicId: string;
  chapterId: string;
  current: number;
  max: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = Array.from({ length: max }, (_, i) => i + 1);

  function pick(n: number) {
    if (isPending) return;
    setError(null);
    setTarget(n);
    startTransition(async () => {
      const res = await setChapterImages(comicId, chapterId, n);
      if (!res.ok) {
        setError(res.error ?? "Gagal membuat gambar. Coba lagi.");
        setTarget(null);
        return;
      }
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <div className="mt-8 rounded-2xl border border-border bg-background/60 p-4">
      {/* Blocking loading screen while panels are drawn. */}
      {isPending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md"
          role="alert"
          aria-live="assertive"
        >
          <div className="mx-4 w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg">
              <ImageIcon className="h-7 w-7 animate-pulse" />
            </div>
            <p className="mt-4 text-base font-bold">
              Menggambar {target} panel bab…
            </p>
            <p className="mt-1 text-sm text-muted">
              AI menyesuaikan tiap gambar dengan alur ceritanya.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {Array.from({ length: target ?? 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-brand-400/25"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-brand-500" />
        <p className="text-sm font-semibold">Gambar bab</p>
        {current > 0 && (
          <span className="text-xs text-muted">· {current} sekarang</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        Bagi bab ini menjadi beberapa panel bergambar yang mengikuti alur
        ceritanya.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((n) => {
          const active = n === current;
          return (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              disabled={isPending}
              aria-pressed={active}
              className={`h-9 w-9 rounded-xl border text-sm font-bold transition-colors disabled:opacity-60 ${
                active
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-border bg-card text-foreground hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {isAdmin && (
        <p className="mt-2 text-[11px] text-muted">
          Sebagai admin kamu bisa sampai {max} panel.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-accent-500/10 p-2 text-xs text-accent-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}
