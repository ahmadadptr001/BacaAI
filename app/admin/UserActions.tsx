"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserRole, deleteUser } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";

/** Promote/demote + delete controls for a single user row. */
export default function UserActions({
  userId,
  role,
  isSelf,
}: {
  userId: string;
  role: "user" | "admin";
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleRole() {
    const next = role === "admin" ? "user" : "admin";
    startTransition(async () => {
      const result = await setUserRole(userId, next);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function remove() {
    if (!confirm("Hapus user ini secara permanen?")) return;
    startTransition(async () => {
      const result = await deleteUser(userId);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  if (isPending) {
    return (
      <span className="flex justify-end">
        <Spinner label="Memproses" />
      </span>
    );
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={toggleRole}
        disabled={isSelf && role === "admin"}
        title={
          isSelf && role === "admin"
            ? "Tidak bisa melepas status admin dirimu sendiri"
            : undefined
        }
        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-brand-400 hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {role === "admin" ? "Jadikan user" : "Jadikan admin"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={isSelf}
        title={isSelf ? "Tidak bisa menghapus akunmu sendiri" : undefined}
        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent-500 hover:text-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Hapus
      </button>
    </div>
  );
}
