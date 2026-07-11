"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BrandMark,
  BookIcon,
  ChevronDownIcon,
} from "@/components/icons";
import type { ChoiceRecord } from "@/lib/types";

function formatDate(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * One comic's reading history. The per-chapter timeline can get long, so it's
 * collapsed by default and expands on demand.
 */
export default function HistoryItem({
  comic,
  history,
}: {
  comic: { id: string; title: string; cover_image_url: string | null } | null;
  history: ChoiceRecord[];
}) {
  const [open, setOpen] = useState(false);
  const babCount = history.length + 1;

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        {comic?.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comic.cover_image_url}
            alt={`Sampul ${comic.title}`}
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-600/15">
            <BrandMark size={30} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">
            {comic?.title ?? "Cerita tanpa judul"}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <BookIcon className="h-3.5 w-3.5" />
            {babCount} bab dijelajahi
          </p>
        </div>
        {comic?.id && (
          <Link
            href={`/comics/${comic.id}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Lanjutkan
            <ArrowRightIcon width={14} height={14} />
          </Link>
        )}
      </div>

      {history.length === 0 ? (
        <p className="border-t border-border p-4 text-sm text-muted">
          Baru bab pembuka, belum ada persimpangan.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-600/15"
          >
            <span className="flex items-center gap-2">
              {open ? "Sembunyikan lini masa" : "Lihat lini masa pilihanmu"}
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                {history.length}
              </span>
            </span>
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          {open && (
            <ol className="border-t border-border p-4">
              {/* Opening node */}
              <li className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-brand-500 bg-card text-xs font-bold text-brand-600 dark:text-brand-400">
                    1
                  </span>
                  <span className="w-0.5 flex-1 bg-border" />
                </div>
                <div className="flex-1 pb-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Bab pembuka
                  </p>
                  <p className="mt-0.5 text-sm text-foreground/80">
                    Awal kisahmu dimulai.
                  </p>
                </div>
              </li>

              {history.map((entry, i) => {
                const when = formatDate(entry.selected_at);
                const last = i === history.length - 1;
                return (
                  <li key={`${entry.choice_id}-${i}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white shadow-sm">
                        {i + 2}
                      </span>
                      {!last && <span className="w-0.5 flex-1 bg-border" />}
                    </div>
                    <div className={`flex-1 ${last ? "" : "pb-5"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                          Bab {i + 2}
                        </p>
                        {when && (
                          <time className="shrink-0 text-[11px] text-muted">
                            {when}
                          </time>
                        )}
                      </div>
                      <div className="mt-1.5 rounded-xl border border-border bg-background p-3">
                        <p className="text-[11px] font-medium text-muted">
                          Kamu mengarahkan cerita:
                        </p>
                        <p className="mt-0.5 text-sm text-foreground/90">
                          {entry.choice_description}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </li>
  );
}
