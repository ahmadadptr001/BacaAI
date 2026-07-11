import Link from "next/link";
import Navbar from "@/components/Navbar";
import ComicCard from "@/components/ComicCard";
import Pagination from "@/components/Pagination";
import { createClient } from "@/lib/supabase/server";
import { SearchIcon, BookIcon } from "@/components/icons";
import type { Comic, UserProgress } from "@/lib/types";

const PAGE_SIZE = 9;

export const metadata = { title: "Cari cerita · BacaAi" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q: qParam, page: pageParam } = await searchParams;
  const q = (qParam ?? "").trim();
  // Neutralise characters that would break a PostgREST or() filter.
  const safeQ = q.replace(/[,()*%\\]/g, " ").trim();
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("comics")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (safeQ) {
    query = query.or(`title.ilike.%${safeQ}%,description.ilike.%${safeQ}%`);
  }
  const { data: comics, count } = await query.range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const list = (comics ?? []) as Comic[];

  let startedComicIds = new Set<string>();
  if (user) {
    const { data: progress } = await supabase
      .from("user_progress")
      .select("comic_id")
      .eq("user_id", user.id);
    startedComicIds = new Set(
      (progress ?? []).map((p: Pick<UserProgress, "comic_id">) => p.comic_id)
    );
  }

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `/jelajah?${params.toString()}`;
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Cari cerita</h1>
        <p className="mt-1 text-sm text-muted">
          Temukan kisah fantasi berikutnya untuk kamu tulis.
        </p>

        <form action="/jelajah" method="get" className="mt-5 flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari judul atau tema…"
              aria-label="Cari cerita"
              className="w-full rounded-full border border-border bg-card py-2.5 pl-11 pr-4 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/40"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-brand-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Cari
          </button>
        </form>

        <p className="mt-4 text-sm text-muted">
          {q ? (
            <>
              {total} hasil untuk <span className="font-medium">“{q}”</span>
            </>
          ) : (
            `${total} cerita`
          )}
        </p>

        {list.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
              <BookIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 font-medium">
              {q ? "Tidak ada cerita yang cocok" : "Belum ada cerita"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {q ? (
                <>
                  Coba kata kunci lain, atau{" "}
                  <Link href="/jelajah" className="text-brand-600 underline">
                    lihat semua cerita
                  </Link>
                  .
                </>
              ) : (
                "Cerita baru sedang disiapkan. Nantikan, ya!"
              )}
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((comic) => (
                <li key={comic.id}>
                  <ComicCard
                    comic={comic}
                    started={startedComicIds.has(comic.id)}
                  />
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
          </>
        )}
      </main>
    </>
  );
}
