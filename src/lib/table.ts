// Detailed table model, shared by the on-page table and the Excel/CSV/PDF exports.
import type { ModuleRow } from "./adapter";
import { mainModuleOf, moduleChecks, sumRows, type ModuleChecks, type Totals } from "./calc";

export type ColumnGroup = "base" | "outcomes" | "defects" | "severity" | "priority" | "ratios";

export const GROUP_LABELS: Record<Exclude<ColumnGroup, "base">, string> = {
  outcomes: "Test outcomes",
  defects: "Defect totals",
  severity: "Severity",
  priority: "Priority",
  ratios: "Extra ratios",
};

export interface TableRow {
  name: string;
  main: string;
  totals: Totals;
  checks: ModuleChecks | null;
  isTotal: boolean;
}

export interface Column {
  key: string;
  label: string;
  group: ColumnGroup;
  value: (r: TableRow) => number | string | null;
  kind: "text" | "int" | "pct" | "dsi";
}

export function validationText(r: TableRow): string {
  const diff = r.checks ? r.checks.statusDiff : r.totals.statusDiff;
  if (r.totals.totalTc === 0) return "No TC data";
  if (diff === 0) return "✓ Reconciled";
  return `⚠ ${diff > 0 ? "+" : "−"}${Math.abs(diff)} vs Total`;
}

export const COLUMNS: Column[] = [
  { key: "module", label: "Module", group: "base", kind: "text", value: (r) => r.name },
  { key: "main", label: "Main Module", group: "base", kind: "text", value: (r) => (r.isTotal ? "" : r.main) },
  { key: "totalTc", label: "Total TC", group: "base", kind: "int", value: (r) => r.totals.totalTc },
  { key: "executed", label: "Executed", group: "base", kind: "int", value: (r) => r.totals.executed },
  { key: "passed", label: "Passed", group: "outcomes", kind: "int", value: (r) => r.totals.passed },
  { key: "failed", label: "Failed", group: "outcomes", kind: "int", value: (r) => r.totals.failed },
  { key: "blocked", label: "Blocked", group: "outcomes", kind: "int", value: (r) => r.totals.blocked },
  { key: "notTested", label: "Not Tested", group: "outcomes", kind: "int", value: (r) => r.totals.notTested },
  { key: "onHold", label: "On Hold", group: "outcomes", kind: "int", value: (r) => r.totals.onHold },
  { key: "notAnIssue", label: "Not an Issue", group: "outcomes", kind: "int", value: (r) => r.totals.notAnIssue },
  { key: "open", label: "Open Defects", group: "defects", kind: "int", value: (r) => r.totals.open },
  { key: "closed", label: "Closed Defects", group: "defects", kind: "int", value: (r) => r.totals.closed },
  { key: "totalDefects", label: "Total Defects", group: "defects", kind: "int", value: (r) => r.totals.totalDefects },
  { key: "sevC", label: "Sev Critical", group: "severity", kind: "int", value: (r) => r.totals.sev.c },
  { key: "sevH", label: "Sev High", group: "severity", kind: "int", value: (r) => r.totals.sev.h },
  { key: "sevM", label: "Sev Medium", group: "severity", kind: "int", value: (r) => r.totals.sev.m },
  { key: "sevL", label: "Sev Low", group: "severity", kind: "int", value: (r) => r.totals.sev.l },
  { key: "priH", label: "Pri High", group: "priority", kind: "int", value: (r) => r.totals.pri.h },
  { key: "priM", label: "Pri Medium", group: "priority", kind: "int", value: (r) => r.totals.pri.m },
  { key: "priL", label: "Pri Low", group: "priority", kind: "int", value: (r) => r.totals.pri.l },
  { key: "passRatio", label: "Pass Ratio", group: "base", kind: "pct", value: (r) => r.totals.passRatio },
  { key: "failRatio", label: "Fail Ratio", group: "ratios", kind: "pct", value: (r) => r.totals.failRatio },
  { key: "blockedRatio", label: "Blocked Ratio", group: "ratios", kind: "pct", value: (r) => r.totals.blockedRatio },
  { key: "notTestedRatio", label: "Not Tested Ratio", group: "ratios", kind: "pct", value: (r) => r.totals.notTestedRatio },
  { key: "executionRatio", label: "Execution Ratio", group: "ratios", kind: "pct", value: (r) => r.totals.executionRatio },
  { key: "dsi", label: "DSI", group: "base", kind: "dsi", value: (r) => r.totals.dsi },
  { key: "validation", label: "Validation", group: "base", kind: "text", value: validationText },
];

export function buildTable(rows: ModuleRow[], totalLabel: string): { body: TableRow[]; total: TableRow } {
  return {
    body: rows.map((r) => ({
      name: r.module, main: mainModuleOf(r.module), totals: sumRows([r]), checks: moduleChecks(r), isTotal: false,
    })),
    total: { name: totalLabel, main: "", totals: sumRows(rows), checks: null, isTotal: true },
  };
}

export function formatCell(c: Column, v: number | string | null): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (c.kind === "pct") return `${(v * 100).toFixed(1)}%`;
  if (c.kind === "dsi") return v.toFixed(2);
  return v.toLocaleString("en-US");
}
