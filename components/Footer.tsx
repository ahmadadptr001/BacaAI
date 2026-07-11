import Link from "next/link";
import { BrandMark } from "./icons";

/** Global site footer with brand, quick links, and a little info. */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-card/50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
            >
              <BrandMark size={26} />
              <span>
                Baca<span className="text-brand-600 dark:text-brand-400">Ai</span>
              </span>
            </Link>
            <p className="mt-3 text-sm text-muted">
              Cerita interaktif di mana kamu jadi penulisnya. Setiap pilihan
              menentukan arah cerita, dan tiap bab ditulis khusus untukmu.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Jelajah
              </span>
              <Link href="/" className="text-foreground/80 hover:text-brand-500">
                Katalog cerita
              </Link>
              <Link
                href="/history"
                className="text-foreground/80 hover:text-brand-500"
              >
                Riwayat cerita
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Akun
              </span>
              <Link
                href="/login"
                className="text-foreground/80 hover:text-brand-500"
              >
                Masuk / Daftar
              </Link>
            </div>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} BacaAi. Semua cerita milik pembacanya.</span>
          <span>Dibuat untuk pencinta cerita bercabang.</span>
        </div>
      </div>
    </footer>
  );
}
