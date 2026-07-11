"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/** Delete a comic (chapters, choices, and progress cascade via FKs). */
export async function deleteComic(comicId: string): Promise<AdminActionState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Akses ditolak." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("comics").delete().eq("id", comicId);
  if (error) return { error: "Gagal menghapus cerita." };

  revalidatePath("/admin");
  revalidatePath("/admin/komik");
  revalidatePath("/");
  revalidatePath("/jelajah");
  return { ok: true };
}

/** Promote or demote a user by setting their profile role. */
export async function setUserRole(
  userId: string,
  role: "user" | "admin"
): Promise<AdminActionState> {
  const me = await requireAdmin().catch(() => null);
  if (!me) return { error: "Akses ditolak." };
  if (userId === me.id && role === "user") {
    return { error: "Kamu tidak bisa melepas status admin dirimu sendiri." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: "Gagal memperbarui role." };

  revalidatePath("/admin");
  return { ok: true };
}

/** Permanently delete a user account. */
export async function deleteUser(userId: string): Promise<AdminActionState> {
  const me = await requireAdmin().catch(() => null);
  if (!me) return { error: "Akses ditolak." };
  if (userId === me.id) {
    return { error: "Kamu tidak bisa menghapus akunmu sendiri." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "Gagal menghapus user." };

  revalidatePath("/admin");
  return { ok: true };
}
