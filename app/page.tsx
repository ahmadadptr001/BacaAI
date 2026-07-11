import Link from "next/link";
import Navbar from "@/components/Navbar";
import ComicCard from "@/components/ComicCard";
import Pagination from "@/components/Pagination";
import { createClient } from "@/lib/supabase/server";
import {
  SparkleIcon,
  PenIcon,
  BookIcon,
  ArrowRightIcon,
} from "@/components/icons";
import type { Comic, UserProgress } from "@/lib/types";

const PAGE_SIZE = 6;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const { data: comics, count } = await supabase
    .from("comics")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Which comics has this user already started? (for a "Resume" badge)
  let startedComicIds = new Set<string>();
  if (user) {
    const { data: progress } = await supabase
      .from("user_progress")
      .select("comic_id")
      .eq("user_id", user.id);
    startedComicIds = new Set(
      (progress ?? []).map((p: Pick<UserProgress, "comic_id">) => p.comic_id),
    );
  }

  const list = (comics ?? []) as Comic[];

  const features = [
    {
      icon: PenIcon,
      title: "Kamu sang penulis",
      body: "Tentukan arah alur di tiap persimpangan cerita.",
    },
    {
      icon: SparkleIcon,
      title: "Bab dibuat khusus",
      body: "AI menulis kelanjutan sesuai pilihanmu, konsisten & tanpa henti.",
    },
    {
      icon: BookIcon,
      title: "Gratis dijelajahi",
      body: "Baca tanpa akun; masuk untuk menyimpan progresmu.",
    },
  ];

  const steps = [
    {
      icon: BookIcon,
      title: "Pilih komik",
      body: "Buka satu cerita dan baca bab pembukanya.",
    },
    {
      icon: PenIcon,
      title: "Tentukan arahnya",
      body: "Pilih ke mana kisah melaju — kamu penulisnya.",
    },
    {
      icon: SparkleIcon,
      title: "Bab baru lahir",
      body: "AI menulis kelanjutannya, dibuat khusus untukmu.",
    },
  ];

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* HERO — full-bleed anime/manhwa scene montage */}
        <section className="relative overflow-hidden bg-black text-white">
          <div className="absolute inset-0" aria-hidden="true">
            {/* Base image shown instantly — the montage never flashes a color. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero/hero-1.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Remaining scenes crossfade on top of the base image. */}
            {["hero-2", "hero-3", "hero-4", "hero-5"].map((name, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={name}
                src={`/hero/${name}.jpg`}
                alt=""
                className="hero-slide absolute inset-0 h-full w-full object-cover opacity-0"
                style={{ animationDelay: `${i * 6}s` }}
              />
            ))}
            {/* Legibility overlay — darker on the text side, reveals the art. */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
          </div>
          <div className="relative mx-auto w-full max-w-5xl px-4 py-20 sm:py-28">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
                Tulis takdirmu sendiri.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/90">
                Selami dunia tempat setiap pilihanmu melahirkan bab baru —
                cerita bercabang tanpa batas yang ditulis khusus untukmu.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#katalog"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm transition-transform hover:scale-[1.03]"
                >
                  Mulai membaca
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                {!user && (
                  <Link
                    href="/login"
                    className="rounded-full border border-white/40 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Masuk untuk menyimpan
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Constrained content */}
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
          {/* FEATURE STRIP */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </section>

        {/* CATALOG */}
        <section id="katalog" className="mt-16 scroll-mt-20">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Jelajahi komik
              </h2>
              <p className="mt-1 text-sm text-muted">
                Pilih satu, dan mulailah menentukan alurnya.
              </p>
            </div>
            <Link
              href="/jelajah"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-100 dark:bg-brand-600/15 dark:text-brand-400"
            >
              Cari komik
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {total === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
                <BookIcon className="h-6 w-6" />
              </span>
              <p className="mt-4 font-medium">Belum ada komik di sini</p>
              <p className="mt-1 text-sm text-muted">
                Cerita baru sedang disiapkan — nantikan, ya!
              </p>
            </div>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 min-[360px]:gap-5 lg:grid-cols-3">
                {list.map((comic) => (
                  <li key={comic.id}>
                    <ComicCard
                      comic={comic}
                      started={startedComicIds.has(comic.id)}
                    />
                  </li>
                ))}
              </ul>
              <Pagination
                page={page}
                totalPages={totalPages}
                hrefFor={(p) => `/?page=${p}#katalog`}
              />
            </>
          )}
        </section>

        {/* HOW IT WORKS */}
        <section className="mt-20">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Cara kerja
          </h2>
          <p className="mx-auto mt-1 max-w-md text-center text-sm text-muted">
            Tiga langkah dari pembaca menjadi penulis.
          </p>
          <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="relative rounded-2xl border border-border bg-card p-6"
              >
                <span className="absolute right-5 top-5 text-4xl font-black text-brand-500/10">
                  {i + 1}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
                  <step.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-6 max-w-md text-center text-sm text-muted">
            Punya ide sendiri?{" "}
            <Link
              href="/buat"
              className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Buat & terbitkan komikmu
            </Link>{" "}
            — pembaca lain yang menentukan alurnya.
          </p>
          </section>
        </div>

        {/* CTA — full-bleed band */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ceritamu menunggu untuk ditulis.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-muted">
              Baca kisah bercabang — atau{" "}
              <span className="font-semibold text-foreground">
                terbitkan komikmu sendiri
              </span>
              . Siapa pun bisa jadi penulisnya di sini; cukup tulis bab
              pembukanya (atau minta bantuan AI), pembaca lain yang melanjutkan.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/buat"
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
              >
                <PenIcon className="h-4 w-4" />
                Buat cerita
              </Link>
              <Link
                href="/jelajah"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 font-semibold transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/15"
              >
                Jelajahi komik
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
