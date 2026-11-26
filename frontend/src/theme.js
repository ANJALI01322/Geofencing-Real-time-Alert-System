import { useCallback, useEffect, useState } from "react";

const KEY = "geotrack-theme";

function stored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Theme hook. The initial theme is set by a tiny inline script in index.html
 * (saved choice, otherwise the system preference) so there is no flash.
 * The user's choice is saved to localStorage; with no saved choice the app
 * follows the system preference live.
 */
export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || stored() || systemTheme()
  );

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const onChange = (e) => {
      if (stored()) return; // an explicit choice wins over the system setting
      const next = e.matches ? "dark" : "light";
      apply(next);
      setTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Several components use this hook; follow the <html> attribute so they all stay in sync
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      const t = el.getAttribute("data-theme");
      if (t === "light" || t === "dark") setTheme(t);
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage unavailable (private mode) - the choice just won't persist
    }
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}
