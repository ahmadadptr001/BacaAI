"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BellIcon, BrandMark } from "@/components/icons";

/**
 * Header bell showing NEW stories published by users. The feed is a rolling
 * 24-hour window (so notifications reset themselves each day), and an unread
 * badge counts the ones created after the reader last opened the bell. "Last
 * opened" is kept in localStorage, so it works for guests too and needs no
 * per-user table.
 */

const SEEN_KEY = "bacaai:notif-seen";

export interface NotifItem {
  id: string;
  title: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  return `${h} jam lalu`;
}

// Read the "last seen" timestamp reactively. useSyncExternalStore keeps SSR and
// hydration consistent (server snapshot = null) and re-reads after we update it.
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function getSeen(): string | null {
  return localStorage.getItem(SEEN_KEY);
}

export default function NotificationBell({ items }: { items: NotifItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const seenAt = useSyncExternalStore(
    subscribe,
    getSeen,
    () => null // server snapshot: unknown → treated as "all unread"
  );

  const unread = items.filter(
    (it) => !seenAt || new Date(it.createdAt).getTime() > new Date(seenAt).getTime()
  ).length;

  // Close on outside click or Escape.
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
    setOpen((o) => {
      const next = !o;
      // Opening marks everything currently listed as seen.
      if (next) localStorage.setItem(SEEN_KEY, new Date().toISOString());
      return next;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notifikasi, ${unread} baru` : "Notifikasi"
        }
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
          className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <BellIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <p className="text-sm font-semibold">Cerita baru</p>
            <span className="ml-auto text-xs text-muted">24 jam terakhir</span>
          </div>

          <div className="my-1 h-px bg-border" />

          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              Belum ada cerita baru hari ini.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    role="menuitem"
                    href={`/comics/${it.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/20"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-600/15">
                      <BrandMark size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {it.title}
                      </span>
                      <span className="block text-xs text-muted">
                        Cerita baru · {timeAgo(it.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
