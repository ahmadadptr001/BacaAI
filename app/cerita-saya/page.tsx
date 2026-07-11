import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import DeleteStoryButton from "./DeleteStoryButton";
import { createClient } from "@/lib/supabase/server";
import { PenIcon, ArrowRightIcon, BrandMark } from "@/components/icons";
import type { Comic } from "@/lib/types";

export const metadata = { title: "Cerita saya · BacaAi" };

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function MyStoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/cerita-saya");

  const { data } = await supabase
    .from("comics")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });
  const stories = (data ?? []) as Comic[];

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Cerita saya
            </h1>
            <p className="mt-1 text-sm text-muted">
              Semua cerita yang kamu terbitkan.
            </p>
          </div>
          <Link
            href="/buat"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <PenIcon className="h-4 w-4" />
            Buat
          </Link>
        </div>

        {stories.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-400">
              <PenIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 font-medium">Kamu belum menerbitkan cerita</p>
            <p className="mt-1 text-sm text-muted">
              Tulis bab pembukanya, biarkan pembaca lain melanjutkannya.
            </p>
            <Link
              href="/buat"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Buat cerita pertamamu
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {stories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                {c.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.cover_image_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-600/15">
                    <BrandMark size={32} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/comics/${c.id}`}
                    className="font-semibold hover:text-brand-600 dark:hover:text-brand-400"
                  >
                    {c.title}
                  </Link>
                  <p className="line-clamp-1 text-sm text-muted">
                    {c.description}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Terbit {formatDate(c.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link
                    href={`/comics/${c.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Baca
                    <ArrowRightIcon width={15} height={15} />
                  </Link>
                  <DeleteStoryButton comicId={c.id} title={c.title} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
