"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "@/components/icons";

interface ChapterItem {
  id: string;
  chapter_number: number;
  title: string;
}

/**
 * Dropdown to jump directly to any chapter the reader has already visited.
 */
export default function ChapterJump({
  comicId,
  chapters,
  currentId,
  dropUp = false,
}: {
  comicId: string;
  chapters: ChapterItem[];
  currentId: string;
  dropUp?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = chapters.find((c) => c.id === currentId);

  function go(id: string) {
    setOpen(false);
    router.push(`/comics/${comicId}?chapter=${id}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/20"
      >
        Bab {current?.chapter_number ?? "?"}
        <ChevronDownIcon
          width={15}
          height={15}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute left-1/2 z-30 max-h-72 w-64 -translate-x-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-lg ${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {chapters.map((c) => {
            const active = c.id === currentId;
            return (
              <button
                key={c.id}
                type="button"
                role="menuitem"
                onClick={() => go(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-brand-50 font-semibold dark:bg-brand-600/20"
                    : "hover:bg-brand-50 dark:hover:bg-brand-600/20"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  {c.chapter_number}
                </span>
                <span className="truncate">{c.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
