import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthForm from "@/components/AuthForm";
import GoogleButton from "@/components/GoogleButton";
import { BrandMark } from "@/components/icons";

export const metadata = { title: "Masuk · BacaAi" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;
  const rt = redirectTo ?? "/";
  const registerHref = `/register${
    rt !== "/" ? `?redirectTo=${encodeURIComponent(rt)}` : ""
  }`;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <BrandMark size={40} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            Selamat datang kembali
          </h1>
          <p className="mt-1 text-sm text-muted">
            Masuk untuk melanjutkan cerita dan menyimpan pilihanmu.
          </p>

          {error === "auth" && (
            <p className="mt-4 rounded-lg bg-accent-500/10 p-3 text-sm text-accent-500">
              Proses masuk tidak berhasil. Silakan coba lagi.
            </p>
          )}

          <div className="mt-6">
            <GoogleButton redirectTo={rt} />
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            atau lanjut dengan email
            <span className="h-px flex-1 bg-border" />
          </div>

          <AuthForm mode="login" redirectTo={rt} />
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          Belum punya akun?{" "}
          <Link
            href={registerHref}
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Daftar sekarang
          </Link>
        </p>
      </main>
    </>
  );
}
