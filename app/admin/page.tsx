import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BookIcon,
  UsersIcon,
  CheckIcon,
  PlusIcon,
  ArrowRightIcon,
} from "@/components/icons";

export default async function AdminOverviewPage() {
  const admin = createAdminClient();

  const [{ count: comicCount }, { count: userCount }, { count: adminCount }] =
    await Promise.all([
      admin.from("comics").select("*", { count: "exact", head: true }),
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin"),
    ]);

  const stats = [
    { label: "Komik", value: comicCount ?? 0, Icon: BookIcon },
    { label: "Pengguna", value: userCount ?? 0, Icon: UsersIcon },
    { label: "Admin", value: adminCount ?? 0, Icon: CheckIcon },
  ];

  return (
    <div>
      <h2 className="text-lg font-bold">Ringkasan</h2>
      <p className="mt-1 text-sm text-muted">
        Sekilas kondisi BacaAi hari ini.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map(({ label, value, Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-extrabold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/admin/tambah"
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <PlusIcon className="h-4 w-4" />
          Tambah komik
        </Link>
        <Link
          href="/admin/komik"
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/15"
        >
          Kelola komik
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
