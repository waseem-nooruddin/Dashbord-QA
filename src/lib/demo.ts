// Demo data for local development (VITE_DEMO=1) and Playwright (VITE_DEMO=synthetic). Never bundled in production:
// data.ts only imports this module behind the VITE_DEMO check.
import type { Project, SnapshotMeta } from "./data";
import synthetic from "../../tests/fixtures/synthetic.json";

// Real sheet data is git-ignored; use it when it exists locally, else the synthetic fixture.
const local = import.meta.glob<Record<string, string[][]>>("../../tests/fixtures/local/*.json", { eager: true, import: "default" });
const real = import.meta.env.VITE_DEMO === "synthetic" ? undefined : Object.values(local)[0];
const sets: Record<string, string[][]> = real ?? { "Demo Project": synthetic as string[][], "Demo Two": (synthetic as string[][]).slice(0, 4) };

const at = new Date().toISOString();
export const projects: Project[] = Object.keys(sets).map((name, i) => ({
  id: `p${i}`, name, spreadsheet_id: "demo", tab: "QA Metrics Severity Priority Report", sort: i,
}));
export const metas: SnapshotMeta[] = projects.map((p, i) => ({
  id: i + 1, project_id: p.id, synced_at: at, checked_at: at, status: "ok", error: null,
}));
export const values = (id: number) => sets[projects[id - 1].name];
