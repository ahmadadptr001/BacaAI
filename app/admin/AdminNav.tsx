"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  PlusIcon,
  BookIcon,
  UsersIcon,
} from "@/components/icons";

const LINKS = [
  { href: "/admin", label: "Ringkasan", Icon: DashboardIcon },
  { href: "/admin/tambah", label: "Tambah komik", Icon: PlusIcon },
  { href: "/admin/komik", label: "Komik", Icon: BookIcon },
  { href: "/admin/pengguna", label: "Pengguna", Icon: UsersIcon },
] as const;

/** Route-based sidebar navigation for the admin dashboard. */
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {LINKS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-600 text-white"
                : "text-muted hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-600/15 dark:hover:text-brand-400"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
