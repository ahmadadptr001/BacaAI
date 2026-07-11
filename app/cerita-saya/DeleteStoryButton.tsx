"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOwnStory } from "@/app/actions/stories";
import { useToast } from "@/components/Toast";
import Spinner from "@/components/Spinner";
import { TrashIcon } from "@/components/icons";

export default function DeleteStoryButton({
  comicId,
  title,
}: {
  comicId: string;
  title: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function onDelete() {
    if (
      !confirm(`Hapus cerita "${title}"? Tindakan ini tidak bisa dibatalkan.`)
    ) {
      return;
    }
    start(async () => {
      const res = await deleteOwnStory(comicId);
      if (res.error) {
        showToast(res.error, "error");
        return;
      }
      showToast("Cerita dihapus.", "success");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent-500 hover:text-accent-500 disabled:opacity-60"
    >
      {pending ? (
        <Spinner label="Menghapus" />
      ) : (
        <>
          <TrashIcon width={14} height={14} />
          Hapus
        </>
      )}
    </button>
  );
}
