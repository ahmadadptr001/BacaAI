import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 *
 * In Next.js 16 `cookies()` is async, so this factory is async too. Await it
 * once per request:  `const supabase = await createClient()`.
 *
 * Server Components cannot write cookies; the try/catch swallows that case.
 * Session refresh cookies are written by the middleware instead (see
 * lib/supabase/middleware.ts).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore because the
            // middleware refreshes the session cookie on every request.
          }
        },
      },
    }
  );
}
