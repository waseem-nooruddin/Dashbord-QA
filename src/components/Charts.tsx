import { useMemo, useState } from "react";
import type { ModuleRow } from "../lib/adapter";
import { moduleChecks } from "../lib/calc";
import {
  barsHeight, chart1, chart2, chart3, chart4, chart5, chart6, chart7, chart8, partsCsv, sortModules,
  DEFECT_PARTS, PRIORITY_PARTS, SEVERITY_PARTS, STATUS_PARTS, type ChartCtx,
} from "../lib/charts";
import { DSI_WEIGHTS, FORMULAS } from "../lib/formulas";
import { ChartCard } from "./ChartCard";
import { EChart } from "./EChart";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);

type Dir = "desc" | "asc" | "sheet";
interface SortState { key: string; dir: Dir }

function useSort(initial: string) {
  const [v, setV] = useState(`${initial}:desc`);
  const [key, dir] = v.split(":") as [string, Dir];
  return { v, setV, s: { key, dir } as SortState };
}

const sheetOrder: [string, string][] = [["sheet:sheet", "Sheet order"]];

function sorted(rows: ModuleRow[], s: SortState, keys: Record<string, (r: ModuleRow) => number>) {
  return sortModules(rows, keys[s.key] ?? (() => 0), s.dir);
}

export function Charts({ ctx, onSelect }: { ctx: ChartCtx; onSelect: (m: string) => void }) {
  const { rows, totals: t } = ctx;

  const s3 = useSort("total");
  const s5 = useSort("total");
  const s6 = useSort("total");
  const s7 = useSort("total");

  const statusKeys = { total: (r: ModuleRow) => r.totalTc, passed: (r: ModuleRow) => r.passed, failed: (r: ModuleRow) => r.failed, blocked: (r: ModuleRow) => r.blocked };
  const defectKeys = { total: (r: ModuleRow) => r.openDefects + r.closedDefects, open: (r: ModuleRow) => r.openDefects, closed: (r: ModuleRow) => r.closedDefects };
  const sevKeys = { total: (r: ModuleRow) => r.sevCritical + r.sevHigh + r.sevMedium + r.sevLow, critical: (r: ModuleRow) => r.sevCritical, high: (r: ModuleRow) => r.sevHigh };
  const priKeys = { total: (r: ModuleRow) => r.priHigh + r.priMedium + r.priLow, high: (r: ModuleRow) => r.priHigh };

  const m3 = useMemo(() => sorted(rows, s3.s, statusKeys), [rows, s3.v]);
  const m5 = useMemo(() => sorted(rows, s5.s, defectKeys), [rows, s5.v]);
  const m6 = useMemo(() => sorted(rows, s6.s, sevKeys), [rows, s6.v]);
  const m7 = useMemo(() => sorted(rows, s7.s, priKeys), [rows, s7.v]);

  const o1 = useMemo(() => chart1(ctx), [ctx]);
  const o2 = useMemo(() => chart2(ctx), [ctx]);
  const o3 = useMemo(() => chart3(ctx, m3), [ctx, m3]);
  const o4 = useMemo(() => chart4(ctx), [ctx]);
  const o5 = useMemo(() => chart5(ctx, m5), [ctx, m5]);
  const o6 = useMemo(() => chart6(ctx, m6), [ctx, m6]);
  const o7 = useMemo(() => chart7(ctx, m7), [ctx, m7]);
  const c8 = useMemo(() => chart8(ctx), [ctx]);

  const unreconciled = rows.filter((r) => r.totalTc > 0 && moduleChecks(r).statusDiff !== 0);
  const noTc = rows.filter((r) => r.totalTc === 0);
  const noPriority = rows.filter((r) => moduleChecks(r).noPriority);
  const dsiMismatch = rows.filter((r) => moduleChecks(r).dsiMismatch);
  const projectSev = rows.reduce((a, r) => a + r.sevCritical + r.sevHigh + r.sevMedium + r.sevLow, 0);
  const projectDefects = rows.reduce((a, r) => a + r.openDefects + r.closedDefects, 0);

  const opts = (labels: [string, string][]) => [...labels.flatMap(([k, l]) => [[`${k}:desc`, `${l} ↓`], [`${k}:asc`, `${l} ↑`]] as [string, string][]), ...sheetOrder];

  return (
    <>
      <div className="chart-grid">
        <ChartCard id="chart-1" number={1} title="Total TC by module"
          subtitle={`Modules under 2% of the project's test cases are grouped as “Other modules”.`}
          csv={() => [["Module", "Total TC"], ...rows.filter((r) => r.totalTc > 0).map((r) => [r.module, r.totalTc])]}
          footnote={noTc.length ? <>Excluded (no TC data): {noTc.map((r) => r.module).join(", ")}</> : undefined}>
          <EChart option={o1} height={340} label="Donut chart of total test cases by module" onSelect={onSelect} />
        </ChartCard>

        <ChartCard id="chart-2" number={2} title="Passed, Failed and Other"
          subtitle={<>{FORMULAS.other}</>}
          csv={() => [["Status", "Count"], ["Passed", t.passed], ["Failed", t.failed], ["Blocked", t.blocked], ["Not Tested", t.notTested], ["On Hold", t.onHold], ["Not an Issue", t.notAnIssue]]}
          footnote={t.statusDiff !== 0 ? <span className="warn">⚠ Statuses total {fmt(t.statusTotal)} vs Total TC {fmt(t.totalTc)} ({t.statusDiff > 0 ? "+" : "−"}{fmt(Math.abs(t.statusDiff))}). Shares use the status total.</span> : <>Statuses reconcile with Total TC ({fmt(t.totalTc)}).</>}>
          <EChart option={o2} height={340} label="Pie chart of passed, failed and other test cases" />
        </ChartCard>

        <ChartCard id="chart-3" number={3} title="Test status by module" wide
          subtitle="Passed, Failed, Blocked and Not Tested per module. ⚠ marks modules whose six statuses don't equal Total TC."
          sort={{ value: s3.v, onChange: s3.setV, options: opts([["total", "Total TC"], ["passed", "Passed"], ["failed", "Failed"], ["blocked", "Blocked"]]) }}
          csv={() => partsCsv(m3, STATUS_PARTS)}
          footnote={unreconciled.length ? <span className="warn">⚠ {unreconciled.length} module{unreconciled.length > 1 ? "s" : ""} not reconciled: {unreconciled.map((r) => `${r.module} (${moduleChecks(r).statusDiff > 0 ? "+" : "−"}${Math.abs(moduleChecks(r).statusDiff)})`).join(", ")}</span> : <>All modules reconcile.</>}>
          <EChart option={o3} height={barsHeight(m3.length)} label="Stacked bar chart of test status per module" onSelect={onSelect} />
        </ChartCard>

        <ChartCard id="chart-4" number={4} title="Open vs Closed defects" wide
          subtitle={<>Total {fmt(t.totalDefects)} · Open share {pct(t.totalDefects ? t.open / t.totalDefects : null)}</>}
          csv={() => [["Open", "Closed", "Total"], [t.open, t.closed, t.totalDefects]]}>
          <EChart option={o4} height={120} label="Stacked bar of open and closed defects" />
        </ChartCard>

        <ChartCard id="chart-5" number={5} title="Open vs Closed defects by module" wide
          sort={{ value: s5.v, onChange: s5.setV, options: opts([["total", "Total"], ["open", "Open"], ["closed", "Closed"]]) }}
          csv={() => partsCsv(m5, DEFECT_PARTS)}>
          <EChart option={o5} height={barsHeight(m5.length)} label="Stacked bar chart of open and closed defects per module" onSelect={onSelect} />
        </ChartCard>

        <ChartCard id="chart-6" number={6} title="Defect severity by module"
          sort={{ value: s6.v, onChange: s6.setV, options: opts([["total", "Total"], ["critical", "Critical"], ["high", "High"]]) }}
          csv={() => partsCsv(m6, SEVERITY_PARTS)}
          footnote={projectSev !== projectDefects ? <>Severity counts ({fmt(projectSev)}) differ from open + closed defects ({fmt(projectDefects)}) in the source.</> : undefined}>
          <EChart option={o6} height={barsHeight(m6.length)} label="Stacked bar chart of defect severity per module" onSelect={onSelect} />
        </ChartCard>

        <ChartCard id="chart-7" number={7} title="Defect priority by module"
          sort={{ value: s7.v, onChange: s7.setV, options: opts([["total", "Total"], ["high", "High"]]) }}
          csv={() => partsCsv(m7, PRIORITY_PARTS)}
          footnote={noPriority.length ? <span className="warn">Defects with no priority: {noPriority.map((r) => r.module).join(", ")}</span> : undefined}>
          <EChart option={o7} height={barsHeight(m7.length)} label="Stacked bar chart of defect priority per module" onSelect={onSelect} />
        </ChartCard>

        <ChartCard id="chart-8" number={8} title="Defect Severity Index by module" wide
          subtitle={<>Scope DSI <b>{t.dsi === null ? "—" : t.dsi.toFixed(2)}</b> · {FORMULAS.dsi} · Weights Critical {DSI_WEIGHTS.critical}, High {DSI_WEIGHTS.high}, Medium {DSI_WEIGHTS.medium}, Low {DSI_WEIGHTS.low}</>}
          csv={() => [["Module", "Calculated DSI", "Sheet DSI"], ...c8.withDsi.map((r) => [r.module, Number(moduleChecks(r).dsi!.toFixed(4)), r.dsiSheet])]}
          footnote={<>
            {c8.without.length > 0 && <div>No classified defects (no DSI): {c8.without.map((r) => r.module).join(", ")}</div>}
            {dsiMismatch.length > 0
              ? <div className="warn">⚠ Calculated DSI differs from the sheet: {dsiMismatch.map((r) => `${r.module} (${moduleChecks(r).dsi?.toFixed(2) ?? "—"} vs ${r.dsiSheet ?? "—"})`).join(", ")}</div>
              : <div>Calculated DSI matches the sheet's DSI column for every module.</div>}
          </>}>
          <EChart option={c8.option} height={barsHeight(c8.withDsi.length)} label="Bar chart of defect severity index per module" onSelect={onSelect} />
        </ChartCard>
      </div>
    </>
  );
}
