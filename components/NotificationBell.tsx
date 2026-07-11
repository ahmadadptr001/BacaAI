"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BellIcon } from "@/components/icons";

/**
 * Header bell showing NEW stories published by users, with who made each one.
 * The feed is a rolling 24-hour window (so it resets itself daily). A story is
 * "unread" until the reader CLICKS it — read ids are kept in localStorage
 * (pruned to the current feed), so it works for guests and needs no table.
 */

const READ_KEY = "bacaai:notif-read";

export interface NotifItem {
  id: string;
  title: string;
  createdAt: string;
  author: string;
}

function parseIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === "string"))
      : new Set();
  } catch {
    return new Set();
  }
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
function getRead(): string | null {
  return localStorage.getItem(READ_KEY);
}

export default function NotificationBell({ items }: { items: NotifItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const readRaw = useSyncExternalStore(subscribe, getRead, () => null);
  const readIds = parseIds(readRaw);

  const isUnread = (id: string) => !readIds.has(id);
  const unread = items.filter((it) => isUnread(it.id)).length;

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

  function markRead(id: string) {
    const set = parseIds(localStorage.getItem(READ_KEY));
    set.add(id);
    // Keep only ids still in the current feed so the list can't grow forever.
    const keep = items.filter((it) => set.has(it.id)).map((it) => it.id);
    localStorage.setItem(READ_KEY, JSON.stringify(keep));
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifikasi, ${unread} baru` : "Notifikasi"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-600/20 dark:hover:text-brand-400"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <BellIcon className="h-4 w-4 text-muted" />
            <p className="text-sm font-semibold">Cerita baru</p>
            <span className="ml-auto text-xs text-muted">24 jam terakhir</span>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted">Belum ada cerita baru hari ini.</p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto p-1.5">
              {items.map((it) => {
                const initial = it.author.charAt(0).toUpperCase() || "?";
                const fresh = isUnread(it.id);
                return (
                  <li key={it.id}>
                    <Link
                      role="menuitem"
                      href={`/comics/${it.id}`}
                      onClick={() => {
                        markRead(it.id);
                        setOpen(false);
                      }}
                      className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-2.5 py-2.5 transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/20 ${
                        fresh ? "bg-brand-50/60 dark:bg-brand-600/10" : ""
                      }`}
                    >
                      {/* "Berkilau" sweep on stories not yet opened. */}
                      {fresh && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                        >
                          <span className="notif-shine absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
                        </span>
                      )}
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
                        {initial}
                      </span>
                      <span className="relative min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">
                            {it.title}
                          </span>
                          {fresh && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          <span className="font-medium text-foreground/80">
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
