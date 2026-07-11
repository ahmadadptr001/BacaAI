import Link from "next/link";
import { ArrowRightIcon, BrandMark } from "./icons";
import type { Comic } from "@/lib/types";

/** A single comic in a catalog grid. Shared by the home and explore pages. */
export default function ComicCard({
  comic,
  started = false,
}: {
  comic: Comic;
  started?: boolean;
}) {
  return (
    <Link
      href={`/comics/${comic.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-brand-50 dark:bg-brand-600/10">
        {comic.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comic.cover_image_url}
            alt={`Sampul ${comic.title}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <BrandMark size={44} />
          </span>
        )}
        {started && (
          <span className="absolute left-3 top-3 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            Lanjutkan
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400">
          {comic.title}
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted">
          {comic.description}
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
          Baca sekarang
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
