import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { advanceFromChoice } from "@/lib/reading";

/**
 * POST /api/generate
 * Body: { choiceId: string }
 *
 * Generates (or reuses the cached) next chapter for a given choice via the AI
 * provider and returns the destination chapter id. Auth is required; RLS scopes
 * writes.
 *
 * The in-app reader uses the `selectChoice` Server Action, which also records
 * progress. This route exposes the generation step as a plain HTTP endpoint
 * (per the project spec) for testing and external callers.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let choiceId: unknown;
  try {
    ({ choiceId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof choiceId !== "string" || !choiceId) {
    return NextResponse.json(
      { error: "`choiceId` is required" },
      { status: 400 }
    );
  }

  try {
    const nextChapterId = await advanceFromChoice(supabase, choiceId);
    return NextResponse.json({ nextChapterId });
  } catch (err) {
    console.error("/api/generate failed:", err);
    return NextResponse.json(
      { error: "AI generation failed. Please try again." },
      { status: 502 }
    );
  }
}
