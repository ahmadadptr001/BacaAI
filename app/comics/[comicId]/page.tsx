import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import ChoiceButtons from "./ChoiceButtons";
import ChoiceLoader from "./ChoiceLoader";
import ChapterJump from "./ChapterJump";
import ChapterProse from "./ChapterProse";
import RestartButton from "./RestartButton";
import { createClient } from "@/lib/supabase/server";
import { getChapterLineage } from "@/lib/reading";
import { ArrowRightIcon } from "@/components/icons";
import type { Chapter, Choice, Comic, UserProgress } from "@/lib/types";

export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ comicId: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { comicId } = await params;
  const { chapter: chapterParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: comic } = await supabase
    .from("comics")
    .select("*")
    .eq("id", comicId)
    .maybeSingle<Comic>();
  if (!comic) notFound();

  // Resume from saved progress (signed-in readers only), or start at chapter 1.
  const { data: progress } = user
    ? await supabase
        .from("user_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("comic_id", comicId)
        .maybeSingle<UserProgress>()
    : { data: null };

  let latestChapterId = progress?.current_chapter_id ?? null;
  if (!latestChapterId) {
    const { data: firstChapter } = await supabase
      .from("chapters")
      .select("id")
      .eq("comic_id", comicId)
      .order("chapter_number", { ascending: true })
      .limit(1)
      .maybeSingle<Pick<Chapter, "id">>();
    latestChapterId = firstChapter?.id ?? null;
  }

  if (!latestChapterId) {
    return (
      <>
        <Navbar comicTitle={comic.title} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
          <p className="rounded-2xl border border-border bg-card p-6 text-muted">
            Komik ini belum memiliki bab.
          </p>
        </main>
      </>
    );
  }

  // The reader's path from the opening chapter to their latest chapter.
  const path = await getChapterLineage(supabase, latestChapterId);
  const pathIds = path.map((c) => c.id);

  // Which chapter are we showing? A ?chapter=<id> only counts if it's on the
  // reader's own path (can't peek at other branches). Default: the latest.
  const shownIndex =
    chapterParam && pathIds.includes(chapterParam)
      ? pathIds.indexOf(chapterParam)
      : pathIds.length - 1;
  const chapter = path[shownIndex];
  if (!chapter) notFound();

  const isLatest = shownIndex === pathIds.length - 1;
  const prevId = shownIndex > 0 ? pathIds[shownIndex - 1] : null;
  const nextId = shownIndex < pathIds.length - 1 ? pathIds[shownIndex + 1] : null;

  const { data: choicesData } = await supabase
    .from("choices")
    .select("*")
    .eq("chapter_id", chapter.id)
    .order("sort_order", { ascending: true });
  const allChoices = (choicesData ?? []) as Choice[];
  // Preset options shown to everyone (a reader's own custom directions are
  // hidden — they belong to that reader's path, not the shared option list).
  const choices = allChoices.filter((c) => !c.is_custom);

  // On a past chapter, which option did the reader take? (leads to next on path)
  const takenChoice = nextId
    ? allChoices.find((c) => c.leads_to_chapter_id === nextId) ?? null
    : null;

  const chapterHref = (id: string) => `/comics/${comicId}?chapter=${id}`;
  const historyCount = progress?.choices_made?.length ?? 0;
  // The opening chapter reads better labelled by the comic's own title than a
  // generic "Bab 1", both in the jump menu and as the page heading.
  const labelFor = (c: Chapter) =>
    c.chapter_number === 1 ? comic.title : c.title;
  const chapterItems = path.map((c) => ({
    id: c.id,
    chapter_number: c.chapter_number,
    title: labelFor(c),
  }));

  return (
    <>
      <Navbar
        comicTitle={comic.title}
        comicId={comicId}
        chapters={chapterItems}
        currentChapterId={chapter.id}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {chapter.image_urls?.length > 0 && (
            <div className="flex flex-col">
              {chapter.image_urls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${url}-${i}`}
                  src={url}
                  alt={`${chapter.title} — panel ${i + 1}`}
                  className="h-72 w-full object-cover sm:h-96"
                />
              ))}
            </div>
          )}

          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
              Bab {chapter.chapter_number} dari {path.length}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold">
              {labelFor(chapter)}
            </h1>

            <ChapterProse text={chapter.content_text} />

            {/* Decision point */}
            <div className="mt-8">
              {isLatest ? (
                choices.length > 0 ? (
                  <ChoiceButtons
                    comicId={comicId}
                    chapterId={chapter.id}
                    choices={choices}
                    isAuthed={!!user}
                  />
                ) : (
                  <ChoiceLoader
                    comicId={comicId}
                    chapterId={chapter.id}
                    isAuthed={!!user}
                  />
                )
              ) : (
                // Read-only view of a past chapter: show the option that was
                // taken and let the reader move forward.
                <div className="flex flex-col gap-3">
                  {takenChoice?.is_custom && (
                    <div className="rounded-2xl border-2 border-brand-400 bg-brand-50 px-5 py-3 text-center text-sm font-medium dark:bg-brand-600/20">
                      <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-brand-500">
                        Arah yang kamu tulis
                      </span>
                      {takenChoice.description}
                    </div>
                  )}
                  {choices.map((choice) => {
                    const taken = choice.id === takenChoice?.id;
                    return (
                      <div
                        key={choice.id}
                        className={`rounded-2xl border-2 px-5 py-3 text-center text-sm ${
                          taken
                            ? "border-brand-400 bg-brand-50 font-medium dark:bg-brand-600/20"
                            : "border-border text-muted"
                        }`}
                      >
                        {choice.description}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </article>

        {/* Chapter navigation */}
        <nav className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            {prevId && (
              <Link
                href={chapterHref(prevId)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/20"
              >
                <ArrowRightIcon width={16} height={16} className="rotate-180" />
                <span className="hidden sm:inline">Bab sebelumnya</span>
              </Link>
            )}
          </div>

          {path.length > 1 && (
            <ChapterJump
              comicId={comicId}
              chapters={chapterItems}
              currentId={chapter.id}
              dropUp
            />
          )}

          <div className="flex flex-1 justify-end">
            {nextId && (
              <Link
                href={chapterHref(nextId)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                <span className="hidden sm:inline">Bab berikutnya</span>
                <ArrowRightIcon width={16} height={16} />
              </Link>
            )}
          </div>
        </nav>

        {/* Path controls */}
        {user && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted">
              {historyCount} arah cerita di jalur ini
            </span>
            <RestartButton comicId={comicId} />
          </div>
        )}
      </main>
    </>
  );
}
