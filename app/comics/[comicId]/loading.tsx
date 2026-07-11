import Spinner from "@/components/Spinner";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-20">
      <div className="flex flex-col items-center gap-3 text-muted">
        <Spinner label="Memuat bab" />
        <p>Memuat ceritamu…</p>
      </div>
    </div>
  );
}
