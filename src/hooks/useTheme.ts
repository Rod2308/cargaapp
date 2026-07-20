import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "carga-theme";

function resolveEffective(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(effective: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", effective === "dark");
  root.style.colorScheme = effective;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", effective === "dark" ? "#0e1116" : "#ffffff");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [effective, setEffective] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && (localStorage.getItem(STORAGE_KEY) as Theme)) || "system";
    setThemeState(stored);
    const eff = resolveEffective(stored);
    setEffective(eff);
    applyTheme(eff);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
      if (current === "system") {
        const e = mq.matches ? "dark" : "light";
        setEffective(e);
        applyTheme(e);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
    const eff = resolveEffective(t);
    setEffective(eff);
    applyTheme(eff);
  }, []);

  const toggle = useCallback(() => {
    setTheme(effective === "dark" ? "light" : "dark");
  }, [effective, setTheme]);

  return { theme, effective, setTheme, toggle };
}
