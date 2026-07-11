"use client";

import { useActionState, useRef, useTransition, useState } from "react";
import {
  createComic,
  suggestComicDraft,
  type StoryActionState,
} from "@/app/actions/stories";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toast";
import { SparkleIcon, CheckIcon } from "@/components/icons";

const initial: StoryActionState = {};

type PreviewStatus = "idle" | "loading" | "ok" | "error";

export default function AddComicForm({
  submitLabel = "Tambah komik",
}: {
  submitLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const storyRef = useRef<HTMLTextAreaElement>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState<PreviewStatus>("idle");
  const [suggesting, startSuggest] = useTransition();
  const toast = useToast();

  // Run the create, then clear the form on success (setState inside an action
  // is fine — the lint rule only forbids it inside effects).
  const [state, action, pending] = useActionState(
    async (prev: StoryActionState, formData: FormData) => {
      const result = await createComic(prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        setImageUrl("");
        setPreview("idle");
      }
      return result;
    },
    initial
  );

  function changeImageUrl(value: string) {
    setImageUrl(value);
    setPreview(value.trim() ? "loading" : "idle");
  }

  function handleSuggest() {
    startSuggest(async () => {
      const result = await suggestComicDraft({
        title: titleRef.current?.value ?? "",
        // Use whatever's already in the synopsis box as a rough idea/steer.
        hint: descRef.current?.value ?? "",
      });
      if (result.error || !result.draft) {
        toast.showToast(result.error ?? "Gagal membuat rekomendasi.", "error");
        return;
      }
      const { title, description, story, imageUrl: url } = result.draft;
      if (titleRef.current && !titleRef.current.value.trim()) {
        titleRef.current.value = title;
      }
      if (descRef.current) descRef.current.value = description;
      if (storyRef.current) storyRef.current.value = story;
      changeImageUrl(url);
      toast.showToast(
        "Rekomendasi AI dimuat — silakan tinjau & sesuaikan.",
        "success"
      );
    });
  }

  const inputClass =
    "rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/40";

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Judul
        <input ref={titleRef} name="title" required className={inputClass} />
      </label>

      {/* AI recommendation: drafts title, synopsis, Bab 1, and a cover image. */}
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-brand-400/50 bg-brand-50/50 p-3 dark:bg-brand-600/10">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="flex items-center justify-center gap-2 self-start rounded-full border border-brand-400 px-4 py-2 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-500 hover:text-white disabled:opacity-60 dark:text-brand-400"
        >
          {suggesting ? (
            <Spinner label="Meracik cerita" />
          ) : (
            <>
              <SparkleIcon className="h-4 w-4" />
              Rekomendasikan cerita (manhwa/anime) dengan AI
            </>
          )}
        </button>
        <p className="text-xs text-muted">
          Isi judul (dan ide singkat di kolom sinopsis) lalu klik — AI menyusun
          sinopsis, Bab 1, dan gambar sampulnya untuk kamu tinjau.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Sinopsis / konteks
        <textarea
          ref={descRef}
          name="description"
          rows={2}
          className={inputClass}
          placeholder="Ringkasan singkat untuk memandu AI dan pembaca."
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Cerita awal (Bab 1)
        <textarea
          ref={storyRef}
          name="story"
          rows={5}
          required
          className={inputClass}
          placeholder="Tulis pembuka cerita. AI akan membuat pilihan lanjutannya."
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        URL gambar
        <input
          name="imageUrl"
          type="url"
          value={imageUrl}
          onChange={(e) => changeImageUrl(e.target.value)}
          className={inputClass}
          placeholder="https://…"
        />
      </label>

      {/* Preview so the admin can see whether the image URL actually loads. */}
      {imageUrl.trim() && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            {preview === "loading" && (
              <span className="flex items-center gap-1.5 text-muted">
                <Spinner label="Memuat pratinjau" />
              </span>
            )}
            {preview === "ok" && (
              <span className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
                <CheckIcon className="h-4 w-4" />
                Gambar valid
              </span>
            )}
            {preview === "error" && (
              <span className="text-accent-500">
                URL gambar tidak bisa dimuat — periksa lagi.
              </span>
            )}
          </div>
          {preview !== "error" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={imageUrl}
              src={imageUrl}
              alt="Pratinjau sampul"
              onLoad={() => setPreview("ok")}
              onError={() => setPreview("error")}
              className={`max-h-56 w-full rounded-lg object-cover ${
                preview === "ok" ? "" : "hidden"
              }`}
            />
          )}
        </div>
      )}

      {state.error && (
        <p className="rounded-lg bg-accent-500/10 p-3 text-sm text-accent-500">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-600 dark:bg-brand-600/20 dark:text-brand-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 self-start rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? <Spinner label="Menyimpan" /> : submitLabel}
      </button>
    </form>
  );
}
