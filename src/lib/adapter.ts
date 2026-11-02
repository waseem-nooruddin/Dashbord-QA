// Source adapter: maps the "QA Metrics Severity Priority Report" tab (A1:X200) by
// column position (SRS 5.1). Row 1 is the header. Ratio columns T–W are ignored.

export interface ModuleRow {
  module: string;
  totalTc: number;
  executed: number;
  openDefects: number;
  closedDefects: number;
  passed: number;
  failed: number;
  blocked: number;
  notTested: number;
  onHold: number;
  notAnIssue: number;
  sevCritical: number;
  sevHigh: number;
  sevMedium: number;
  sevLow: number;
  priHigh: number;
  priMedium: number;
  priLow: number;
  /** Column X, used only to cross-check the recalculated DSI. */
  dsiSheet: number | null;
  /** False when the row has a module name but no numbers. */
  hasData: boolean;
}

// Column index → field. L (11, "Blocker") counts blocked TCs, not a severity, so it is unused.
const COLUMNS: [number, keyof ModuleRow][] = [
  [1, "totalTc"], [2, "executed"], [3, "openDefects"], [4, "closedDefects"],
  [5, "passed"], [6, "failed"], [7, "blocked"], [8, "notTested"], [9, "onHold"], [10, "notAnIssue"],
  [12, "sevCritical"], [13, "sevHigh"], [14, "sevMedium"], [15, "sevLow"],
  [16, "priHigh"], [17, "priMedium"], [18, "priLow"],
];
const DSI_COL = 23;

function num(cell: unknown): number | null {
  if (cell === undefined || cell === null) return null;
  const s = String(cell).replace(/[,\s%]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseRows(values: unknown[][]): ModuleRow[] {
  const out: ModuleRow[] = [];
  for (const row of values.slice(1)) {
    const module = String(row?.[0] ?? "").trim();
    if (!module) continue;
    const r = { module, dsiSheet: num(row[DSI_COL]), hasData: false } as ModuleRow;
    for (const [i, field] of COLUMNS) {
      const n = num(row[i]);
      if (n !== null) r.hasData = true;
      (r[field] as number) = n ?? 0;
    }
    out.push(r);
  }
  return out;
}
