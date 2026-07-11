import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and keeps the auth
 * cookies in sync. Called from the root middleware.ts.
 *
 * IMPORTANT (per Supabase SSR guidance): always return the `supabaseResponse`
 * object as-is so the refreshed cookies are propagated to the browser.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and getUser() — it must be the
  // first auth call so the session is refreshed before anything reads it.
  // We refresh the session on every request but do NOT force login: browsing
  // and reading are open to everyone. Signing in is only needed to make
  // choices (which save your progress).
  await supabase.auth.getUser();

  return supabaseResponse;
}
