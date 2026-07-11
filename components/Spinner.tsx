/** Simple accessible loading spinner. */
export default function Spinner({ label = "Memuat" }: { label?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2"
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
