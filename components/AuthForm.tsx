"use client";

import { useActionState, useEffect } from "react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";

const initialState: AuthState = {};

/**
 * Shared credential form for the split /login and /register pages. The mode
 * picks the action, button label, and autocomplete hints.
 */
export default function AuthForm({
  mode,
  redirectTo,
}: {
  mode: "login" | "register";
  redirectTo: string;
}) {
  const { showToast } = useToast();
  const isLogin = mode === "login";
  const [state, formAction, pending] = useActionState(
    isLogin ? signIn : signUp,
    initialState
  );

  useEffect(() => {
    if (state.error) showToast(state.error, "error");
    else if (state.message) showToast(state.message, "success");
  }, [state, showToast]);

  const inputClass =
    "rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/40";

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Kata sandi
        <input
          type="password"
          name="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          required
          minLength={6}
          className={inputClass}
        />
        {!isLogin && (
          <span className="text-xs font-normal text-muted">
            Minimal 6 karakter.
          </span>
        )}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex items-center justify-center rounded-full bg-brand-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? (
          <Spinner label={isLogin ? "Sedang masuk" : "Membuat akun"} />
        ) : isLogin ? (
          "Masuk"
        ) : (
          "Buat akun"
        )}
      </button>
    </form>
  );
}
