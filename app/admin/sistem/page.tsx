import os from "node:os";
import AreaChart from "@/components/AreaChart";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ActivityIcon,
  ServerIcon,
  CpuIcon,
  ClockIcon,
  DatabaseIcon,
  BookIcon,
  PenIcon,
  UsersIcon,
  SpeechIcon,
  CheckIcon,
  AlertTriangleIcon,
} from "@/components/icons";

export const metadata = { title: "Performa sistem · BacaAi" };

// Always render fresh: these are live runtime + database measurements.
export const dynamic = "force-dynamic";

const DAYS = 14;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}h ${h}j`;
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m ${s % 60}d`;
  return `${s}d`;
}

// ---------------------------------------------------------------------------
// Health status: colour is ALWAYS paired with an icon + label (never colour
// alone), per the dataviz house rules.
// ---------------------------------------------------------------------------

type Level = "good" | "warning" | "critical";

const LEVEL_META: Record<
  Level,
  { label: string; hex: string; Icon: typeof CheckIcon; tint: string }
> = {
  good: {
    label: "Normal",
    hex: "#10b981",
    Icon: CheckIcon,
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    label: "Waspada",
    hex: "#f59e0b",
    Icon: AlertTriangleIcon,
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  critical: {
    label: "Kritis",
    hex: "#f43f5e",
    Icon: AlertTriangleIcon,
    tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

function StatusPill({ level }: { level: Level }) {
  const { label, tint, Icon } = LEVEL_META[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tint}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export default async function SystemPerformancePage() {
  const admin = createAdminClient();

  const now = new Date().getTime();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const H1 = iso(60 * 60 * 1000);
  const H24 = iso(24 * 60 * 60 * 1000);
  const D7 = iso(7 * 24 * 60 * 60 * 1000);
  const D14 = iso(DAYS * 24 * 60 * 60 * 1000);

  // Count-only helper (head:true → no rows transferred, just the count).
  const head = { count: "exact" as const, head: true };

  const [
    comicsTotal,
    chaptersTotal,
    choicesTotal,
    profilesTotal,
    progressTotal,
    userChoicesTotal,
    generatedTotal,
    cachedChoices,
    customChoicesTotal,
    comics24h,
    comics7d,
    chapters24h,
    generated1h,
    generated7d,
    custom24h,
    userChoices24h,
    chapterRows,
    recentComics,
    profiles,
  ] = await Promise.all([
    admin.from("comics").select("*", head),
    admin.from("chapters").select("*", head),
    admin.from("choices").select("*", head),
    admin.from("profiles").select("*", head),
    admin.from("user_progress").select("*", head),
    admin.from("user_choices").select("*", head),
    admin.from("chapters").select("*", head).eq("is_generated", true),
    admin.from("choices").select("*", head).not("leads_to_chapter_id", "is", null),
    admin.from("choices").select("*", head).eq("is_custom", true),
    admin.from("comics").select("*", head).gte("created_at", H24),
    admin.from("comics").select("*", head).gte("created_at", D7),
    admin.from("chapters").select("*", head).gte("created_at", H24),
    admin
      .from("chapters")
      .select("*", head)
      .eq("is_generated", true)
      .gte("created_at", H1),
    admin
      .from("chapters")
      .select("*", head)
      .eq("is_generated", true)
      .gte("created_at", D7),
    admin.from("choices").select("*", head).eq("is_custom", true).gte("created_at", H24),
    admin.from("user_choices").select("*", head).gte("selected_at", H24),
    admin
      .from("chapters")
      .select("created_at, is_generated")
      .gte("created_at", D14),
    admin
      .from("comics")
      .select("created_by, created_at")
      .gte("created_at", H24)
      .not("created_by", "is", null),
    admin.from("profiles").select("id, role"),
  ]);

  const num = (r: { count: number | null }) => r.count ?? 0;

  // --- Daily "bab digenerate AI" series (last DAYS days) --------------------
  const chapters = (chapterRows.data ?? []) as {
    created_at: string;
    is_generated: boolean;
  }[];
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const series = Array.from({ length: DAYS }, (_, k) => {
    const day = new Date(midnight);
    day.setDate(midnight.getDate() - (DAYS - 1 - k));
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const value = chapters.filter((c) => {
      if (!c.is_generated) return false;
      const t = new Date(c.created_at);
      return t >= day && t < next;
    }).length;
    return { label: `${day.getDate()}/${day.getMonth() + 1}`, value };
  });

  // --- Runtime metrics ------------------------------------------------------
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
  const heapPct =
    mem.heapTotal > 0 ? Math.round((mem.heapUsed / mem.heapTotal) * 100) : 0;
  const cpus = os.cpus();
  const load1 = os.loadavg()[0]; // 0 on Windows, meaningful on Linux hosts
  const loadPerCore = cpus.length > 0 ? load1 / cpus.length : 0;

  // --- Abnormal-activity monitors ------------------------------------------
  const roleById = new Map(
    (profiles.data ?? []).map((p: { id: string; role: string }) => [
      p.id,
      p.role,
    ])
  );
  const perUser = new Map<string, number>();
  for (const c of (recentComics.data ?? []) as { created_by: string }[]) {
    if (roleById.get(c.created_by) === "admin") continue;
    perUser.set(c.created_by, (perUser.get(c.created_by) ?? 0) + 1);
  }
  const topUserStories = perUser.size > 0 ? Math.max(...perUser.values()) : 0;

  const gen1h = num(generated1h);
  const gen7d = num(generated7d);
  const hourlyAvg = gen7d / (7 * 24);
  const cust24h = num(custom24h);

  type Monitor = {
    name: string;
    level: Level;
    detail: string;
    Icon: typeof CheckIcon;
  };

  const spamLevel: Level =
    topUserStories >= 5 ? "critical" : topUserStories >= 3 ? "warning" : "good";
  const spikeLevel: Level =
    gen1h >= 30 || (hourlyAvg >= 1 && gen1h > hourlyAvg * 10)
      ? "critical"
      : gen1h >= 15 || (hourlyAvg >= 0.5 && gen1h > hourlyAvg * 6)
        ? "warning"
        : "good";
  const custLevel: Level =
    cust24h >= 120 ? "critical" : cust24h >= 40 ? "warning" : "good";
  const heapLevel: Level =
    heapPct >= 92 ? "critical" : heapPct >= 80 ? "warning" : "good";

  const monitors: Monitor[] = [
    {
      name: "Lonjakan pembuatan cerita",
      level: spamLevel,
      Icon: BookIcon,
      detail:
        topUserStories === 0
          ? "Tidak ada pengguna non-admin yang menerbitkan cerita dalam 24 jam terakhir."
          : `Pengguna paling aktif menerbitkan ${topUserStories} cerita dalam 24 jam. Wajar ≤ 2; ≥ 5 kemungkinan spam.`,
    },
    {
      name: "Lonjakan generate bab AI",
      level: spikeLevel,
      Icon: ActivityIcon,
      detail: `${gen1h} bab digenerate dalam 1 jam terakhir (rata-rata ${hourlyAvg.toFixed(
        1
      )}/jam selama 7 hari). Lonjakan tajam bisa berarti penyalahgunaan atau bot.`,
    },
    {
      name: "Volume arah cerita kustom",
      level: custLevel,
      Icon: PenIcon,
      detail: `${cust24h} arah cerita kustom ditulis dalam 24 jam. Volume sangat tinggi perlu ditinjau.`,
    },
    {
      name: "Tekanan memori proses",
      level: heapLevel,
      Icon: ServerIcon,
      detail: `Heap terpakai ${heapPct}% (${fmtBytes(mem.heapUsed)} / ${fmtBytes(
        mem.heapTotal
      )}). Di atas 80% menandakan proses mendekati batas memori.`,
    },
  ];

  // Overall system health = worst monitor.
  const order: Record<Level, number> = { good: 0, warning: 1, critical: 2 };
  const overall = monitors.reduce<Level>(
    (worst, m) => (order[m.level] > order[worst] ? m.level : worst),
    "good"
  );
  const anomalies = monitors.filter((m) => m.level !== "good");

  // --- Tile config ----------------------------------------------------------
  const runtimeTiles = [
    {
      label: "Memori proses (RSS)",
      value: fmtBytes(mem.rss),
      sub: `Heap ${fmtBytes(mem.heapUsed)} / ${fmtBytes(mem.heapTotal)}`,
      Icon: ServerIcon,
    },
    {
      label: "Uptime proses",
      value: fmtDuration(process.uptime()),
      sub: `Node ${process.version}`,
      Icon: ClockIcon,
    },
    {
      label: "CPU",
      value: `${cpus.length} core`,
      sub: cpus[0]?.model?.trim() || os.arch(),
      Icon: CpuIcon,
    },
    {
      label: "Beban rata-rata (1m)",
      value: load1.toFixed(2),
      sub:
        load1 === 0
          ? "Tidak tersedia di host ini"
          : `${Math.round(loadPerCore * 100)}% per core`,
      Icon: ActivityIcon,
    },
  ];

  const dbTiles = [
    { label: "Cerita", value: num(comicsTotal), Icon: BookIcon },
    { label: "Bab", value: num(chaptersTotal), Icon: BookIcon },
    { label: "Bab digenerate AI", value: num(generatedTotal), Icon: ActivityIcon },
    { label: "Pilihan", value: num(choicesTotal), Icon: SpeechIcon },
    { label: "Pilihan kustom", value: num(customChoicesTotal), Icon: PenIcon },
    { label: "Pengguna", value: num(profilesTotal), Icon: UsersIcon },
    { label: "Progres baca", value: num(progressTotal), Icon: BookIcon },
    { label: "Log pilihan", value: num(userChoicesTotal), Icon: SpeechIcon },
  ];

  const cachePct =
    num(choicesTotal) > 0
      ? Math.round((num(cachedChoices) / num(choicesTotal)) * 100)
      : 0;

  const activityRows = [
    { label: "Cerita baru", d1: num(comics24h), d7: num(comics7d) },
    { label: "Bab dibuat", d1: num(chapters24h), d7: "—" as number | string },
    { label: "Bab digenerate AI", d1: gen1h, d7: gen7d },
    { label: "Arah cerita kustom", d1: cust24h, d7: "—" as number | string },
    { label: "Pilihan dibaca", d1: num(userChoices24h), d7: "—" as number | string },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Performa sistem</h2>
          <p className="mt-1 text-sm text-muted">
            Metrik runtime, jejak basis data, dan pemantauan aktivitas abnormal
            secara langsung.
          </p>
        </div>
        <StatusPill level={overall} />
      </div>

      {/* Anomaly banner: only when something is off. */}
      {anomalies.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-2xl border p-4"
          style={{
            borderColor: LEVEL_META[overall].hex,
            backgroundColor: `${LEVEL_META[overall].hex}14`,
          }}
        >
          <AlertTriangleIcon
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: LEVEL_META[overall].hex }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {anomalies.length} indikator perlu perhatian
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {anomalies.map((a) => a.name).join(", ")}. Tinjau bagian pemantauan
              di bawah.
            </p>
          </div>
        </div>
      )}

      {/* Runtime metrics */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-muted">
          <ServerIcon className="h-4 w-4" />
          Runtime server
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {runtimeTiles.map(({ label, value, sub, Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 truncate text-xl font-extrabold">{value}</p>
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 truncate text-[11px] text-muted" title={sub}>
                {sub}
              </p>
            </div>
          ))}
        </div>

        {/* Memory bars */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MeterCard
            label="Memori sistem terpakai"
            value={`${fmtBytes(usedMem)} / ${fmtBytes(totalMem)}`}
            pct={memPct}
            level={memPct >= 90 ? "critical" : memPct >= 75 ? "warning" : "good"}
          />
          <MeterCard
            label="Heap V8 terpakai"
            value={`${fmtBytes(mem.heapUsed)} / ${fmtBytes(mem.heapTotal)}`}
            pct={heapPct}
            level={heapLevel}
          />
        </div>
      </section>

      {/* Database footprint */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-muted">
          <DatabaseIcon className="h-4 w-4" />
          Jejak basis data
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dbTiles.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-2 text-xl font-extrabold">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <MeterCard
            label="Pilihan yang sudah ter-cache (mengarah ke bab)"
            value={`${num(cachedChoices)} / ${num(choicesTotal)}`}
            pct={cachePct}
            level="good"
          />
        </div>
      </section>

      {/* Chart */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 className="font-bold">Bab digenerate AI</h3>
          <span className="text-xs text-muted">{DAYS} hari terakhir</span>
        </div>
        <p className="mb-4 text-sm text-muted">
          Beban kerja AI harian. Lonjakan mendadak sering menandakan aktivitas
          otomatis yang tidak wajar.
        </p>
        <AreaChart data={series} unit="bab" />
      </section>

      {/* Activity windows */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h3 className="font-bold">Jendela aktivitas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="pb-2 font-medium">Metrik</th>
                <th className="pb-2 text-right font-medium">24 jam</th>
                <th className="pb-2 text-right font-medium">7 hari</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activityRows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2.5">{r.label}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">
                    {r.d1}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted">
                    {r.d7}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Abnormal-activity monitor */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ActivityIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h3 className="font-bold">Pemantauan aktivitas abnormal</h3>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {monitors.map((m) => (
            <li key={m.name} className="flex items-start gap-3 py-3.5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${LEVEL_META[m.level].tint}`}
              >
                <m.Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{m.name}</p>
                  <StatusPill level={m.level} />
                </div>
                <p className="mt-0.5 text-sm text-muted">{m.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MeterCard({
  label,
  value,
  pct,
  level,
}: {
  label: string;
  value: string;
  pct: number;
  level: Level;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm font-bold tabular-nums">{clamped}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${clamped}%`,
            backgroundColor: LEVEL_META[level].hex,
          }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">{value}</p>
    </div>
  );
}
