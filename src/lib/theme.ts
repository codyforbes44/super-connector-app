/**
 * Public-site light/dark theme, persisted across sessions in localStorage.
 * The authenticated app stays dark; only the marketing pages expose the toggle.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "sixvox-theme";

const THEME_COLOR: Record<Theme, string> = {
  dark: "#08131c",
  light: "#f4f8fb",
};

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

export function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function readTheme(): Theme {
  return readStoredTheme() ?? getSystemTheme();
}

/** Inlined in the document head so the first paint already has the right theme. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}var r=document.documentElement;r.classList.toggle("dark",t==="dark");r.classList.toggle("light",t==="light");}catch(e){}})();`;

/** Theme state for the public site. Reads the class the bootstrap script set. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = readStoredTheme();
    const initial = stored ?? getSystemTheme();
    setThemeState(initial);
    applyTheme(initial);

    // If the user has not set an explicit preference, follow the system.
    if (!stored) {
      const mql = window.matchMedia("(prefers-color-scheme: light)");
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches ? "light" : "dark");
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage can be unavailable in private modes — the class still applies */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme };
}

/** Force dark while a component is mounted (the in-app shell), preference untouched. */
export function useForcedDarkTheme() {
  useEffect(() => {
    applyTheme("dark");
    return () => {
      applyTheme(readTheme());
    };
  }, []);
}
