import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "auto";
export type Theme = "light" | "dark";

/** Status colours (SRS 7.3): the same meaning in every chart and both themes. */
export const C = {
  passed: "#16A34A",
  failed: "#DC2626",
  blocked: "#F97316",
  notTested: "#3B82F6",
  medium: "#EAB308",
  sky: "#38BDF8",
  navy: "#0B2858",
};

export interface Palette {
  text: string;
  muted: string;
  grid: string;
  card: string;
  dsiBar: string;
  /** Categorical colours for chart 1. */
  series: string[];
}

export const PALETTES: Record<Theme, Palette> = {
  light: {
    text: "#0F172A", muted: "#64748B", grid: "#E2E8F0", card: "#FFFFFF", dsiBar: "#0B2858",
    series: ["#0B2858", "#38BDF8", "#1E40AF", "#0EA5E9", "#6366F1", "#14B8A6", "#64748B", "#7DD3FC", "#312E81", "#0891B2", "#94A3B8", "#A5B4FC"],
  },
  dark: {
    text: "#E2E8F0", muted: "#94A3B8", grid: "#24324D", card: "#121B2E", dsiBar: "#60A5FA",
    series: ["#60A5FA", "#38BDF8", "#818CF8", "#22D3EE", "#A78BFA", "#2DD4BF", "#94A3B8", "#7DD3FC", "#C4B5FD", "#67E8F9", "#CBD5E1", "#3B82F6"],
  },
};

/** Text colour for a label sitting on a filled segment (SRS 7.4). */
export const labelOn = (fill: string) => (fill === C.medium || fill === C.sky ? C.navy : "#FFFFFF");

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem("qa-livesync-theme");
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch { /* storage unavailable */ }
  return "auto";
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);
  const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
  const [systemDark, setSystemDark] = useState(media?.matches ?? false);

  useEffect(() => {
    if (!media) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener("change", on);
    return () => media.removeEventListener("change", on);
  }, [media]);

  const theme: Theme = choice === "auto" ? (systemDark ? "dark" : "light") : choice;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("qa-livesync-theme", choice); } catch { /* ignore */ }
  }, [theme, choice]);

  return { choice, setChoice, theme };
}
