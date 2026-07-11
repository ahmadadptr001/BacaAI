"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { restartComic } from "@/app/actions/reading";
import Spinner from "@/components/Spinner";
import { RestartIcon } from "@/components/icons";

/** Resets progress to chapter 1 so the reader can try a different path. */
export default function RestartButton({ comicId }: { comicId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function restart() {
    if (!confirm("Ulangi komik ini dari awal dengan pilihan baru?")) {
      return;
    }
    startTransition(async () => {
      await restartComic(comicId);
      // Back to the opening chapter with a clean URL.
      router.push(`/comics/${comicId}`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={restart}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium text-muted transition-colors hover:text-accent-500 disabled:opacity-60"
    >
      {isPending ? (
        <Spinner label="Mengulang" />
      ) : (
        <>
          <RestartIcon width={16} height={16} /> Ulangi
        </>
      )}
    </button>
  );
}
