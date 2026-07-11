import Link from "next/link";
import Navbar from "@/components/Navbar";
import AuthForm from "@/components/AuthForm";
import GoogleButton from "@/components/GoogleButton";
import { BrandMark } from "@/components/icons";

export const metadata = { title: "Daftar · BacaAi" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const rt = redirectTo ?? "/";
  const loginHref = `/login${
    rt !== "/" ? `?redirectTo=${encodeURIComponent(rt)}` : ""
  }`;

  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <BrandMark size={40} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            Buat akun BacaAi
          </h1>
          <p className="mt-1 text-sm text-muted">
            Daftar untuk mulai menulis ceritamu sendiri. Bisa langsung dipakai,
            tanpa perlu konfirmasi email.
          </p>

          <div className="mt-6">
            <GoogleButton redirectTo={rt} />
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            atau daftar dengan email
            <span className="h-px flex-1 bg-border" />
          </div>

          <AuthForm mode="register" redirectTo={rt} />
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          Sudah punya akun?{" "}
          <Link
            href={loginHref}
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Masuk di sini
          </Link>
        </p>
      </main>
    </>
  );
}
