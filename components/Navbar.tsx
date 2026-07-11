import Link from "next/link";
import { getAuthContext } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import NotificationBell, { type NotifItem } from "./NotificationBell";
import ChapterJump from "@/app/comics/[comicId]/ChapterJump";
import { BrandMark } from "./icons";

interface ChapterItem {
  id: string;
  chapter_number: number;
  title: string;
}

/** A friendly display name from an email's local part (no PII beyond that). */
function authorName(email: string | null | undefined): string {
  if (!email) return "Pengguna";
  const local = email.split("@")[0]?.replace(/[._]+/g, " ").trim();
  if (!local) return "Pengguna";
  return local.charAt(0).toUpperCase() + local.slice(1);
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

  // New stories published by users in the last 24h (feed resets itself daily),
  // with the author's display name. We use the service-role client because the
  // profiles RLS policy hides other users' rows from a normal session.
  const since = new Date(
    new Date().getTime() - 24 * 60 * 60 * 1000
  ).toISOString();
  const admin = createAdminClient();
  const { data: recent } = await admin
    .from("comics")
    .select("id, title, created_at, created_by")
    .not("created_by", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(12);
  const rows = (recent ?? []) as {
    id: string;
    title: string;
    created_at: string;
    created_by: string | null;
  }[];

  const authorIds = [
    ...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)),
  ];
  const emailById = new Map<string, string | null>();
  if (authorIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", authorIds);
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) {
      emailById.set(p.id, p.email);
    }
  }

  const notifications: NotifItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    author: authorName(r.created_by ? emailById.get(r.created_by) : null),
  }));

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
          <NotificationBell items={notifications} />
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
