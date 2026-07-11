import Link from "next/link";
import Navbar from "@/components/Navbar";
import HistoryItem from "./HistoryItem";
import { createClient } from "@/lib/supabase/server";
import type { Comic, UserProgress } from "@/lib/types";

type ProgressWithComic = UserProgress & {
  comics: Pick<Comic, "id" | "title" | "cover_image_url"> | null;
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <h1 className="mb-6 text-2xl font-extrabold">Riwayat pilihanmu</h1>
          <p className="rounded-2xl border border-border bg-card p-6 text-muted">
            Masuk untuk melacak pilihan yang kamu buat dan meninjau ceritamu.{" "}
            <Link
              href="/login?redirectTo=/history"
              className="font-medium text-brand-500 underline"
            >
              Masuk
            </Link>
            .
          </p>
        </main>
      </>
    );
  }

  const { data } = await supabase
    .from("user_progress")
    .select("*, comics(id, title, cover_image_url)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as ProgressWithComic[];

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Riwayat pilihanmu
        </h1>
        <p className="mt-1 text-sm text-muted">
          Setiap keputusan yang membentuk ceritamu, tersusun sebagai lini masa.
        </p>

        {rows.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-border bg-card p-6 text-muted">
            Kamu belum membuat pilihan apa pun.{" "}
            <Link href="/" className="font-medium text-brand-500 underline">
              Mulai sebuah cerita
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-5">
            {rows.map((row) => (
              <HistoryItem
                key={row.id}
                comic={row.comics}
                history={row.choices_made ?? []}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
