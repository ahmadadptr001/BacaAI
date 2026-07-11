import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";

/**
 * Authorization helpers. Admin status is stored in `profiles.role` ('admin').
 * The first admin is set manually via SQL (see schema.sql); after that admins
 * promote others from the dashboard.
 */

export interface AuthContext {
  user: User | null;
  isAdmin: boolean;
}

/** Resolve the current user and whether they are an admin. */
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  return { user, isAdmin: profile?.role === "admin" };
}

/** Throw unless the caller is an authenticated admin. Use inside Server Actions. */
export async function requireAdmin(): Promise<User> {
  const { user, isAdmin } = await getAuthContext();
  if (!user || !isAdmin) {
    throw new Error("Forbidden: admin access required");
  }
  return user;
}
