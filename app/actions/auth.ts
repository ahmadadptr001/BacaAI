"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuthState {
  error?: string;
  message?: string;
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

/** Append the raw provider message during development to aid debugging. */
function withDevDetail(message: string, raw: string): string {
  return process.env.NODE_ENV === "production" ? message : `${message} [${raw}]`;
}

/** Sign in with email + password, then redirect to the reader's destination. */
export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const redirectTo = String(formData.get("redirectTo") ?? "/") || "/";

  if (!email || !password) {
    return { error: "Silakan masukkan email dan kata sandimu." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("signIn error:", error.message);
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials")) {
      return { error: "Email atau kata sandi salah." };
    }
    if (msg.includes("email not confirmed")) {
      return { error: "Email belum dikonfirmasi. Cek kotak masukmu." };
    }
    return { error: withDevDetail("Gagal masuk. Silakan coba lagi.", error.message) };
  }

  redirect(redirectTo);
}

/**
 * Create an account and sign the reader straight in — NO email verification,
 * ever. We deliberately do NOT use the public `auth.signUp` (which tries to
 * send a confirmation email and can hit Supabase's email rate limit). Instead
 * we create the user via the admin API with `email_confirm: true` (already
 * confirmed, zero emails sent), then establish a session with a normal sign-in.
 */
export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const redirectTo = String(formData.get("redirectTo") ?? "/") || "/";

  if (!email || !password) {
    return { error: "Silakan masukkan email dan kata sandimu." };
  }
  if (password.length < 6) {
    return { error: "Kata sandi minimal 6 karakter." };
  }

  // Create the account already-confirmed, without sending any email.
  const admin = createAdminClient();
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    console.error("signUp(createUser) error:", createErr.message);
    const msg = createErr.message.toLowerCase();
    if (/already|registered|exists|duplicate/i.test(msg)) {
      return { error: "Email ini sudah terdaftar. Silakan masuk." };
    }
    if (msg.includes("password")) {
      return { error: "Kata sandi terlalu lemah (minimal 6 karakter)." };
    }
    if (msg.includes("email")) {
      return { error: "Format email tidak valid." };
    }
    return {
      error: withDevDetail(
        "Gagal membuat akun. Silakan coba lagi.",
        createErr.message
      ),
    };
  }

  // Establish the session on the reader's browser and go straight in.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr) {
    console.error("post-signup signIn error:", signInErr.message);
    return {
      error: withDevDetail(
        "Akun dibuat, tapi gagal masuk otomatis. Coba masuk lagi.",
        signInErr.message
      ),
    };
  }

  redirect(redirectTo);
}
