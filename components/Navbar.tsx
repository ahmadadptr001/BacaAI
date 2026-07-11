import Link from "next/link";
import { getAuthContext } from "@/lib/authz";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import ChapterJump from "@/app/comics/[comicId]/ChapterJump";
import { BrandMark } from "./icons";

interface ChapterItem {
  id: string;
  chapter_number: number;
  title: string;
}

/**
 * Top navigation bar. Shows the logo, an optional current comic title, a
 * chapter-jump dropdown while reading, the theme toggle, and auth state.
 */
export default async function Navbar({
  comicTitle,
  comicId,
  chapters,
  currentChapterId,
  progressLabel,
}: {
  comicTitle?: string;
  comicId?: string;
  chapters?: ChapterItem[];
  currentChapterId?: string;
  progressLabel?: string;
}) {
  const { user, isAdmin } = await getAuthContext();

  const showJump =
    comicId && currentChapterId && chapters && chapters.length > 1;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
        >
          <BrandMark size={28} />
          <span>
            Baca<span className="text-brand-600 dark:text-brand-400">Ai</span>
          </span>
        </Link>

        {comicTitle && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span aria-hidden="true" className="hidden text-muted sm:inline">
              /
            </span>
            <span className="hidden truncate font-medium sm:inline">
              {comicTitle}
            </span>
            {showJump ? (
              <ChapterJump
                comicId={comicId!}
                chapters={chapters!}
                currentId={currentChapterId!}
              />
            ) : (
              progressLabel && (
                <span className="whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-600/20 dark:text-brand-400">
                  {progressLabel}
                </span>
              )
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <UserMenu email={user.email ?? ""} isAdmin={isAdmin} />
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Masuk
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
