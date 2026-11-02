// Calculation layer: the single place totals, ratios, DSI and validation are computed.
// Charts, table and exports only read these results.
import type { ModuleRow } from "./adapter";
import { DSI_TOLERANCE, DSI_WEIGHTS } from "./formulas";

export interface MainModule {
  name: string;
  modules: ModuleRow[];
}

export interface Severity { c: number; h: number; m: number; l: number }

export interface Totals {
  modules: number;
  totalTc: number;
  executed: number;
  passed: number;
  failed: number;
  blocked: number;
  notTested: number;
  onHold: number;
  notAnIssue: number;
  other: number;
  statusTotal: number;
  statusDiff: number;
  open: number;
  closed: number;
  totalDefects: number;
  sev: Severity;
  sevTotal: number;
  pri: { h: number; m: number; l: number };
  priTotal: number;
  /** Ratios over modules with test cases; null when the scope has none. */
  passRatio: number | null;
  failRatio: number | null;
  blockedRatio: number | null;
  notTestedRatio: number | null;
  executionRatio: number | null;
  dsi: number | null;
}

export interface ModuleChecks {
  statusDiff: number;
  noTcData: boolean;
  noPriority: boolean;
  dsi: number | null;
  dsiMismatch: boolean;
}

export function mainModuleOf(name: string): string {
  if (name.startsWith("HRMS - ")) return "HRMS";
  if (name.startsWith("Member ")) return "Member";
  return name;
}

/** Main modules in order of first appearance in the sheet. */
export function groupModules(rows: ModuleRow[]): MainModule[] {
  const map = new Map<string, MainModule>();
  for (const r of rows) {
    const name = mainModuleOf(r.module);
    if (!map.has(name)) map.set(name, { name, modules: [] });
    map.get(name)!.modules.push(r);
  }
  return [...map.values()];
}

export function dsi(s: Severity): number | null {
  const n = s.c + s.h + s.m + s.l;
  if (n === 0) return null;
  return (DSI_WEIGHTS.critical * s.c + DSI_WEIGHTS.high * s.h + DSI_WEIGHTS.medium * s.m + DSI_WEIGHTS.low * s.l) / n;
}

export const otherOf = (r: Pick<ModuleRow, "blocked" | "notTested" | "onHold" | "notAnIssue">) =>
  r.blocked + r.notTested + r.onHold + r.notAnIssue;

export function sumRows(rows: ModuleRow[]): Totals {
  const s = (f: (r: ModuleRow) => number, list = rows) => list.reduce((a, r) => a + f(r), 0);
  const withTc = rows.filter((r) => r.totalTc > 0);
  const tcBase = s((r) => r.totalTc, withTc);
  const ratio = (f: (r: ModuleRow) => number) => (tcBase > 0 ? s(f, withTc) / tcBase : null);

  const passed = s((r) => r.passed);
  const failed = s((r) => r.failed);
  const blocked = s((r) => r.blocked);
  const notTested = s((r) => r.notTested);
  const onHold = s((r) => r.onHold);
  const notAnIssue = s((r) => r.notAnIssue);
  const other = blocked + notTested + onHold + notAnIssue;
  const totalTc = s((r) => r.totalTc);
  const open = s((r) => r.openDefects);
  const closed = s((r) => r.closedDefects);
  const sev = { c: s((r) => r.sevCritical), h: s((r) => r.sevHigh), m: s((r) => r.sevMedium), l: s((r) => r.sevLow) };
  const pri = { h: s((r) => r.priHigh), m: s((r) => r.priMedium), l: s((r) => r.priLow) };

  return {
    modules: rows.length,
    totalTc,
    executed: s((r) => r.executed),
    passed, failed, blocked, notTested, onHold, notAnIssue, other,
    statusTotal: passed + failed + other,
    statusDiff: passed + failed + other - totalTc,
    open, closed, totalDefects: open + closed,
    sev, sevTotal: sev.c + sev.h + sev.m + sev.l,
    pri, priTotal: pri.h + pri.m + pri.l,
    passRatio: ratio((r) => r.passed),
    failRatio: ratio((r) => r.failed),
    blockedRatio: ratio((r) => r.blocked),
    notTestedRatio: ratio((r) => r.notTested),
    executionRatio: ratio((r) => r.executed),
    dsi: dsi(sev),
  };
}

export function moduleChecks(r: ModuleRow): ModuleChecks {
  const calc = dsi({ c: r.sevCritical, h: r.sevHigh, m: r.sevMedium, l: r.sevLow });
  // The sheet writes 0 (or nothing) where there are no classified defects.
  const sheet = r.dsiSheet ?? 0;
  const dsiMismatch = calc === null ? sheet !== 0 : Math.abs(calc - sheet) > DSI_TOLERANCE;
  return {
    statusDiff: r.passed + r.failed + otherOf(r) - r.totalTc,
    noTcData: r.totalTc === 0,
    noPriority: r.openDefects + r.closedDefects > 0 && r.priHigh + r.priMedium + r.priLow === 0,
    dsi: calc,
    dsiMismatch,
  };
}
