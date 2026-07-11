import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import AreaChart from "@/components/AreaChart";
import {
  BookIcon,
  UsersIcon,
  CheckIcon,
  PenIcon,
  BellIcon,
  ArrowRightIcon,
} from "@/components/icons";
import type { Comic } from "@/lib/types";

const DAYS = 14;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  return `${Math.floor(d / 30)} bulan lalu`;
}

type ComicRow = Pick<Comic, "id" | "title" | "created_at" | "created_by">;

export default async function AdminOverviewPage() {
  const admin = createAdminClient();

  const [{ data: comicsData }, { data: profiles }] = await Promise.all([
    admin
      .from("comics")
      .select("id, title, created_at, created_by")
      .order("created_at", { ascending: true }),
    admin.from("profiles").select("id, email, role"),
  ]);

  const comics = (comicsData ?? []) as ComicRow[];
  const roleById = new Map(
    (profiles ?? []).map((p: { id: string; role: string }) => [p.id, p.role])
  );
  const emailById = new Map(
    (profiles ?? []).map((p: { id: string; email: string | null }) => [
      p.id,
      p.email,
    ])
  );

  // Stories added by non-admin readers = the "notifications" feed.
  const userStories = comics.filter(
    (c) => c.created_by && roleById.get(c.created_by) !== "admin"
  );
  const notifications = [...userStories]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 8);

  const adminCount = (profiles ?? []).filter(
    (p: { role: string }) => p.role === "admin"
  ).length;

  const stats = [
    { label: "Komik", value: comics.length, Icon: BookIcon },
    { label: "Cerita pengguna", value: userStories.length, Icon: PenIcon },
    { label: "Pengguna", value: (profiles ?? []).length, Icon: UsersIcon },
    { label: "Admin", value: adminCount, Icon: CheckIcon },
  ];

  // Daily series: stories added per day over the last DAYS days.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = Array.from({ length: DAYS }, (_, k) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (DAYS - 1 - k));
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const value = comics.filter((c) => {
      const t = new Date(c.created_at);
      return t >= day && t < next;
    }).length;
    return { label: `${day.getDate()}/${day.getMonth() + 1}`, value };
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold">Ringkasan</h2>
        <p className="mt-1 text-sm text-muted">
          Sekilas kondisi BacaAi hari ini.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
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

      {/* Chart */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 className="font-bold">Cerita ditambahkan</h3>
          <span className="text-xs text-muted">{DAYS} hari terakhir</span>
        </div>
        <p className="mb-4 text-sm text-muted">
          Jumlah komik baru yang masuk tiap hari.
        </p>
        <AreaChart data={series} unit="cerita" />
      </section>

      {/* Notifications: stories from non-admin users */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <BellIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h3 className="font-bold">Cerita baru dari pengguna</h3>
          {notifications.length > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
              {userStories.length}
            </span>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="text-sm text-muted">
            Belum ada cerita yang dibuat oleh pengguna non-admin.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {notifications.map((c) => {
              const email = c.created_by
                ? emailById.get(c.created_by) ?? null
                : null;
              const who = email ?? "Seorang pengguna";
              const initial = (email ?? "?").charAt(0).toUpperCase();
              return (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-semibold">{who}</span>{" "}
                      <span className="text-muted">menambahkan</span>{" "}
                      <Link
                        href={`/comics/${c.id}`}
                        className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {c.title}
                      </Link>
                    </p>
                    <p className="text-xs text-muted">{timeAgo(c.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/tambah"
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <PenIcon className="h-4 w-4" />
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
