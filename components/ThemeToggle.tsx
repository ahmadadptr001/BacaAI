"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./icons";

/**
 * Dark-mode toggle. The `dark` class on <html> is the single source of truth
 * (set pre-hydration by an inline script in the root layout, so there's no
 * flash). We subscribe to that class with useSyncExternalStore instead of
 * mirroring it into local state, and persist the choice in localStorage.
 */
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore storage errors (private mode) */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      className="inline-flex items-center rounded-full border border-border p-2 leading-none transition-colors hover:bg-brand-50 dark:hover:bg-brand-600/20"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
