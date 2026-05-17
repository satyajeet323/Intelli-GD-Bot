import { useState, useEffect } from "react";

type Theme = "dark" | "light";

// ── Singleton state shared across all hook instances ──────────────────────────
let _theme: Theme = (() => {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("gd-theme") as Theme | null;
  return stored === "light" || stored === "dark" ? stored : "dark";
})();

let _listeners: Array<(t: Theme) => void> = [];

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
  }
  localStorage.setItem("gd-theme", t);
}

function setGlobalTheme(t: Theme) {
  _theme = t;
  applyTheme(t);
  _listeners.forEach((fn) => fn(t));
}

// Apply on module load so the class is set before first render
if (typeof window !== "undefined") applyTheme(_theme);

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(_theme);

  useEffect(() => {
    const listener = (t: Theme) => setTheme(t);
    _listeners.push(listener);
    // Sync in case theme changed while this component was unmounted
    setTheme(_theme);
    return () => {
      _listeners = _listeners.filter((fn) => fn !== listener);
    };
  }, []);

  const toggle = () => setGlobalTheme(_theme === "dark" ? "light" : "dark");

  return { theme, toggle };
}
