"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteComic } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";

export default function ComicActions({
  comicId,
  title,
}: {
  comicId: string;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Hapus cerita "${title}"? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteComic(comicId);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isPending}
      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-accent-500 hover:text-accent-500 disabled:opacity-60"
    >
      {isPending ? <Spinner label="Menghapus" /> : "Hapus"}
    </button>
  );
}
