"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BellIcon } from "@/components/icons";

/**
 * Header bell showing NEW stories published by users, with who made each one.
 * The feed is a rolling 24-hour window (so notifications reset themselves each
 * day), and an unread badge counts the ones created after the reader last
 * opened the bell. "Last opened" lives in localStorage, so it works for guests
 * too and needs no per-user table.
 */

const SEEN_KEY = "bacaai:notif-seen";

export interface NotifItem {
  id: string;
  title: string;
  createdAt: string;
  author: string;
}

// Cheerful avatar colours, picked deterministically from the author's name.
const AVATAR_COLORS = [
  "#7c3aed",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];
function colorFor(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  return `${h} jam lalu`;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function getSeen(): string | null {
  return localStorage.getItem(SEEN_KEY);
}

export default function NotificationBell({ items }: { items: NotifItem[] }) {
  const [open, setOpen] = useState(false);
  // The "seen" timestamp captured when the dropdown was opened. We compute each
  // item's "new" glow against THIS (not the live value we bump on open), so an
  // item keeps sparkling while you look at it and only settles next time.
  const [openedSeen, setOpenedSeen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const seenAt = useSyncExternalStore(subscribe, getSeen, () => null);

  const isNew = (iso: string) =>
    !openedSeen || new Date(iso).getTime() > new Date(openedSeen).getTime();

  const unread = items.filter(
    (it) =>
      !seenAt || new Date(it.createdAt).getTime() > new Date(seenAt).getTime()
  ).length;

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

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    // Snapshot the previous "seen" mark for the glow, then mark all as seen so
    // the badge/ping clears. The dispatched event re-reads the live value.
    setOpenedSeen(localStorage.getItem(SEEN_KEY));
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
    window.dispatchEvent(new Event("storage"));
    setOpen(true);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifikasi, ${unread} baru` : "Notifikasi"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-600/20 dark:hover:text-brand-400"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-60" />
            <span className="relative flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        >
          {/* Festive gradient header */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-3 text-white">
            <span className="text-base">✨</span>
            <p className="text-sm font-bold">Cerita baru</p>
            {unread > 0 && (
              <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
                {unread} baru
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-3xl">🌙</p>
              <p className="mt-2 text-sm text-muted">
                Belum ada cerita baru hari ini.
              </p>
              <p className="text-xs text-muted">Cek lagi nanti ya!</p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto p-1.5">
              {items.map((it) => {
                const initial = it.author.charAt(0).toUpperCase() || "?";
                const fresh = isNew(it.createdAt);
                return (
                  <li key={it.id}>
                    <Link
                      role="menuitem"
                      href={`/comics/${it.id}`}
                      onClick={() => setOpen(false)}
                      className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-2.5 py-2.5 transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/20 ${
                        fresh ? "bg-brand-50/70 dark:bg-brand-600/10" : ""
                      }`}
                    >
                      {/* "Berkilau" sweep on freshly arrived stories. */}
                      {fresh && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                        >
                          <span className="notif-shine absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/15" />
                        </span>
                      )}
                      <span
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-sm"
                        style={{ backgroundColor: colorFor(it.author) }}
                      >
                        {initial}
                      </span>
                      <span className="relative min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">
                            {it.title}
                          </span>
                          {fresh && (
                            <span className="shrink-0 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-500">
                              ✨ Baru
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          <span className="font-medium text-brand-600 dark:text-brand-400">
                            {it.author}
                          </span>{" "}
                          menerbitkan · {timeAgo(it.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
