"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DashboardIcon,
  HistoryIcon,
  LogoutIcon,
  PenIcon,
} from "@/components/icons";

/**
 * Avatar button with a dropdown menu holding account actions. Keeps the header
 * clean by collapsing history/admin/sign-out behind the avatar.
 */
export default function UserMenu({
  email,
  isAdmin,
}: {
  email: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/20";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu akun"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white shadow-sm ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-brand-400/50"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 origin-top-right rounded-2xl border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="text-xs text-muted">Masuk sebagai</p>
            <p className="truncate text-sm font-semibold">{email}</p>
          </div>

          <div className="my-1 h-px bg-border" />

          <Link
            role="menuitem"
            href="/buat"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <PenIcon width={17} height={17} className="text-muted" />
            Buat cerita
          </Link>
          <Link
            role="menuitem"
            href="/history"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            <HistoryIcon width={17} height={17} className="text-muted" />
            Riwayat
          </Link>
          {isAdmin && (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className={`${itemClass} text-accent-500`}
            >
              <DashboardIcon width={17} height={17} />
              Dashboard Admin
            </Link>
          )}

          <div className="my-1 h-px bg-border" />

          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className={`${itemClass} text-muted`}>
              <LogoutIcon width={17} height={17} />
              Keluar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
