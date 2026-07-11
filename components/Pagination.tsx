import Link from "next/link";
import { ArrowRightIcon } from "./icons";

/**
 * Server-rendered pagination. `hrefFor(page)` builds the link for each page so
 * it works with whatever query params the host page uses (e.g. ?page, ?q).
 */
export default function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  // Compact window of page numbers around the current page.
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let p = Math.max(1, end - 4); p <= end; p++) pages.push(p);

  const linkBase =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/20";
  const disabled =
    "pointer-events-none inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border px-3 text-sm font-medium text-muted opacity-40";

  return (
    <nav
      className="mt-8 flex items-center justify-center gap-2"
      aria-label="Navigasi halaman"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkBase} aria-label="Sebelumnya">
          <ArrowRightIcon width={16} height={16} className="rotate-180" />
        </Link>
      ) : (
        <span className={disabled} aria-hidden="true">
          <ArrowRightIcon width={16} height={16} className="rotate-180" />
        </span>
      )}

      {pages.map((p) => (
        <Link
          key={p}
          href={hrefFor(p)}
          aria-current={p === page ? "page" : undefined}
          className={
            p === page
              ? "inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-brand-600 px-3 text-sm font-semibold text-white"
              : linkBase
          }
        >
          {p}
        </Link>
      ))}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkBase} aria-label="Berikutnya">
          <ArrowRightIcon width={16} height={16} />
        </Link>
      ) : (
        <span className={disabled} aria-hidden="true">
          <ArrowRightIcon width={16} height={16} />
        </span>
      )}
    </nav>
  );
}
