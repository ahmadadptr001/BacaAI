"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ensureChoices } from "@/app/actions/reading";
import Spinner from "@/components/Spinner";
import { PenIcon } from "@/components/icons";

/**
 * Rendered when the current chapter has no decision-point options yet.
 * For signed-in readers it asks the AI to generate them (with a loading
 * state), then refreshes to reveal the choices. Guests are invited to sign in.
 */
export default function ChoiceLoader({
  comicId,
  chapterId,
  isAuthed,
}: {
  comicId: string;
  chapterId: string;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await ensureChoices(chapterId);
      if (!result.ok) {
        setError(result.error ?? "Gagal membuat pilihan. Silakan coba lagi.");
        return;
      }
      router.refresh();
    });
  }

  // Kick off generation automatically once, for signed-in readers.
  useEffect(() => {
    if (isAuthed && !startedRef.current) {
      startedRef.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  if (!isAuthed) {
    return (
      <div className="rounded-2xl bg-brand-50 p-6 text-center dark:bg-brand-600/15">
        <p className="font-semibold">Lanjutkan menulis kisahmu</p>
        <p className="mt-1 text-sm text-muted">
          Masuk agar AI menyiapkan arah cerita untuk bab berikutnya.
        </p>
        <Link
          href={`/login?redirectTo=/comics/${comicId}`}
          className="mt-3 inline-block rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Masuk
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p role="alert" className="text-sm text-accent-500">
          {error}
        </p>
        <button
          type="button"
          onClick={generate}
          className="mt-3 rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-brand-50 p-6 text-center dark:bg-brand-600/15">
      <span className="flex items-center gap-2 font-medium">
        <PenIcon width={16} height={16} />
        Menyiapkan arah cerita untuk kamu tentukan…
      </span>
      {isPending && <Spinner label="Membuat pilihan" />}
    </div>
  );
}
