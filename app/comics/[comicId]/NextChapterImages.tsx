"use client";

import { useSyncExternalStore } from "react";
import { ImageIcon } from "@/components/icons";

/**
 * Compact top-of-page control that sets how many panel images the NEXT
 * generated chapter should have (1..max — 4 for readers, 6 for admins). The
 * choice is kept in localStorage and read by ChoiceButtons when the reader
 * advances, so picking a direction generates a chapter split into that many
 * on-flow panels. Kept in the header so readers don't scroll to change it.
 */

export const NEXT_IMAGES_KEY = "bacaai:next-images";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function getStored() {
  return localStorage.getItem(NEXT_IMAGES_KEY);
}

export default function NextChapterImages({
  max,
  isAdmin,
}: {
  max: number;
  isAdmin: boolean;
}) {
  const stored = useSyncExternalStore(subscribe, getStored, () => null);
  const value = Math.max(1, Math.min(max, Number(stored) || 1));
  const options = Array.from({ length: max }, (_, i) => i + 1);

  function pick(n: number) {
    localStorage.setItem(NEXT_IMAGES_KEY, String(n));
    // Same-tab reactivity (the storage event only fires in OTHER tabs).
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-brand-500" />
        <span className="text-sm font-semibold">Gambar bab berikutnya</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {options.map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              aria-pressed={active}
              aria-label={`${n} gambar untuk bab berikutnya`}
              className={`h-8 w-8 rounded-lg border text-sm font-bold transition-colors ${
                active
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-border bg-background text-foreground hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      <span className="text-xs text-muted">
        {value === 1 ? "1 gambar" : `${value} panel mengikuti alur`}
        {isAdmin ? ` · admin s/d ${max}` : ""}
      </span>
    </div>
  );
}
