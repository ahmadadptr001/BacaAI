import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import ComicActions from "../ComicActions";
import { PlusIcon } from "@/components/icons";
import type { Comic } from "@/lib/types";

export const metadata = { title: "Komik — BacaAi" };

export default async function AdminComicsPage() {
  const admin = createAdminClient();
  const { data: comics } = await admin
    .from("comics")
    .select("*")
    .order("created_at", { ascending: false });
  const comicList = (comics ?? []) as Comic[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          Komik <span className="text-muted">({comicList.length})</span>
        </h2>
        <Link
          href="/admin/tambah"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <PlusIcon className="h-4 w-4" />
          Tambah
        </Link>
      </div>

      {comicList.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted">
          Belum ada komik.{" "}
          <Link href="/admin/tambah" className="text-brand-600 underline">
            Buat yang pertama
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comicList.map((comic) => (
            <li
              key={comic.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              {comic.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comic.cover_image_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/comics/${comic.id}`}
                  className="font-semibold hover:underline"
                >
                  {comic.title}
                </Link>
                <p className="truncate text-sm text-muted">
                  {comic.description}
                </p>
              </div>
              <ComicActions comicId={comic.id} title={comic.title} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
