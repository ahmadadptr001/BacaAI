import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the SERVICE ROLE key. This bypasses Row Level
 * Security, so it must ONLY ever be used server-side, and only after an
 * `requireAdmin()` check. Never import this into a Client Component.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (Dashboard → Project Settings → API).
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
