// ECharts option builders for charts 1–8. They only read the calculation layer.
import type { EChartsCoreOption } from "echarts/core";
import type { ModuleRow } from "./adapter";
import { moduleChecks, otherOf, type Totals } from "./calc";
import { DONUT_MIN_SHARE } from "./formulas";
import { C, labelOn, type Palette } from "./theme";

export interface ChartCtx {
  /** Every module of the project; out-of-scope ones fade to 30% (SRS 7.4). */
  rows: ModuleRow[];
  scope: Set<string>;
  totals: Totals;
  pal: Palette;
}

interface Part {
  name: string;
  color: string;
  get: (r: ModuleRow) => number;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (n: number) => n.toLocaleString("en-US");
const opacity = (ctx: ChartCtx, name: string) => (ctx.scope.has(name) ? 1 : 0.3);

function tooltipBase(pal: Palette) {
  return {
    backgroundColor: pal.card,
    borderColor: pal.grid,
    textStyle: { color: pal.text, fontSize: 12 },
    confine: true,
  };
}

/** Horizontal stacked bars per module with counts inside and the total at the end. */
function stackedBars(
  ctx: ChartCtx,
  modules: ModuleRow[],
  parts: Part[],
  opts: { warn?: (r: ModuleRow) => string | null; empty?: (r: ModuleRow) => string | null } = {},
): EChartsCoreOption {
  const { pal } = ctx;
  const totals = modules.map((r) => parts.reduce((a, p) => a + p.get(r), 0));
  const max = Math.max(1, ...totals);
  const byName = new Map(modules.map((r) => [r.module, r]));

  return {
    animationDuration: 300,
    grid: { left: 8, right: 64, top: 30, bottom: 4, containLabel: true },
    legend: { top: 0, left: 0, data: parts.map((p) => p.name), textStyle: { color: pal.text }, itemWidth: 12, itemHeight: 10 },
    tooltip: {
      ...tooltipBase(pal),
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (ps: { dataIndex: number }[]) => {
        const r = modules[ps[0].dataIndex];
        const lines = parts.map((p) => `<span style="color:${p.color}">●</span> ${p.name}: <b>${fmt(p.get(r))}</b>`);
        const warn = opts.warn?.(r);
        return [`<b>${esc(r.module)}</b>`, ...lines, `Total: <b>${fmt(totals[ps[0].dataIndex])}</b>`, warn ? `⚠ ${esc(warn)}` : ""]
          .filter(Boolean).join("<br/>");
      },
    },
    xAxis: { type: "value", axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
    yAxis: {
      type: "category",
      inverse: true,
      data: modules.map((r) => r.module),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: pal.grid } },
      axisLabel: {
        color: pal.text,
        width: 170,
        overflow: "truncate",
        formatter: (n: string) => (opts.warn?.(byName.get(n)!) ? `⚠ ${n}` : n),
      },
      triggerEvent: true,
    },
    series: [
      ...parts.map((p) => ({
        name: p.name,
        type: "bar",
        stack: "s",
        barMaxWidth: 22,
        itemStyle: { color: p.color },
        label: {
          show: true,
          color: labelOn(p.color),
          fontSize: 11,
          formatter: (x: { value: number }) => (x.value > 0 && x.value / max >= 0.045 ? fmt(x.value) : ""),
        },
        data: modules.map((r) => ({ value: p.get(r), itemStyle: { opacity: opacity(ctx, r.module) } })),
      })),
      {
        name: "_total",
        type: "bar",
        stack: "s",
        silent: true,
        tooltip: { show: false },
        data: modules.map(() => 0),
        label: {
          show: true,
          position: "right",
          color: pal.muted,
          fontSize: 11,
          formatter: (x: { dataIndex: number }) => {
            const empty = opts.empty?.(modules[x.dataIndex]);
            return empty ?? fmt(totals[x.dataIndex]);
          },
        },
      },
    ],
  };
}

export const barsHeight = (n: number) => Math.max(160, n * 30 + 50);

export type SortKey = string;

export function sortModules(rows: ModuleRow[], key: (r: ModuleRow) => number, dir: "desc" | "asc" | "sheet") {
  if (dir === "sheet") return rows;
  const s = [...rows].sort((a, b) => key(b) - key(a));
  return dir === "asc" ? s.reverse() : s;
}

// ── Chart 1: Total TC by module ───────────────────────────────────────────────
export function chart1(ctx: ChartCtx): EChartsCoreOption {
  const { pal } = ctx;
  const withTc = ctx.rows.filter((r) => r.totalTc > 0);
  const total = withTc.reduce((a, r) => a + r.totalTc, 0);
  const big = withTc.filter((r) => r.totalTc / total >= DONUT_MIN_SHARE);
  const small = withTc.filter((r) => r.totalTc / total < DONUT_MIN_SHARE);
  const data: object[] = big.map((r, i) => ({
    name: r.module,
    value: r.totalTc,
    itemStyle: { color: pal.series[i % pal.series.length], opacity: opacity(ctx, r.module) },
  }));
  if (small.length) {
    data.push({
      name: "Other modules",
      value: small.reduce((a, r) => a + r.totalTc, 0),
      itemStyle: { color: pal.muted, opacity: small.some((r) => ctx.scope.has(r.module)) ? 1 : 0.3 },
      modules: small.map((r) => `${r.module}: ${fmt(r.totalTc)}`),
    });
  }
  return {
    animationDuration: 300,
    tooltip: {
      ...tooltipBase(pal),
      trigger: "item",
      formatter: (p: { name: string; value: number; percent: number; data: { modules?: string[] } }) =>
        `<b>${esc(p.name)}</b><br/>Total TC: <b>${fmt(p.value)}</b> (${p.percent.toFixed(1)}%)` +
        (p.data.modules ? `<br/>${p.data.modules.map(esc).join("<br/>")}` : ""),
    },
    legend: { type: "scroll", orient: "horizontal", bottom: 0, textStyle: { color: pal.text, fontSize: 11 }, pageTextStyle: { color: pal.muted } },
    title: {
      text: fmt(ctx.totals.totalTc),
      subtext: "Total TC in scope",
      left: "center",
      top: "36%",
      textStyle: { color: pal.text, fontSize: 24, fontWeight: 700 },
      subtextStyle: { color: pal.muted, fontSize: 11 },
    },
    series: [{
      type: "pie",
      radius: ["48%", "72%"],
      center: ["50%", "44%"],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: pal.card, borderWidth: 2 },
      label: { show: true, position: "inside", color: "#FFFFFF", fontSize: 10, formatter: (p: { value: number; percent: number }) => (p.percent >= 5 ? fmt(p.value) : "") },
      data,
    }],
  };
}

// ── Chart 2: Passed / Failed / Other for the scope ───────────────────────────
export function chart2(ctx: ChartCtx): EChartsCoreOption {
  const { pal, totals: t } = ctx;
  const slices = [
    { name: "Passed", value: t.passed, color: C.passed },
    { name: "Failed", value: t.failed, color: C.failed },
    { name: "Other", value: t.other, color: C.sky },
  ];
  return {
    animationDuration: 300,
    tooltip: {
      ...tooltipBase(pal),
      trigger: "item",
      formatter: (p: { name: string; value: number; percent: number }) =>
        `<b>${p.name}</b>: ${fmt(p.value)} (${p.percent.toFixed(1)}% of status total)` +
        (p.name === "Other" ? `<br/>Blocked ${fmt(t.blocked)} · Not Tested ${fmt(t.notTested)}<br/>On Hold ${fmt(t.onHold)} · Not an Issue ${fmt(t.notAnIssue)}` : ""),
    },
    legend: { bottom: 0, textStyle: { color: pal.text } },
    series: [{
      type: "pie",
      radius: "70%",
      center: ["50%", "45%"],
      itemStyle: { borderColor: pal.card, borderWidth: 2 },
      label: {
        show: true,
        position: "inside",
        fontSize: 12,
        fontWeight: 600,
        formatter: (p: { value: number; percent: number }) => (p.percent >= 4 ? `${fmt(p.value)}\n${p.percent.toFixed(1)}%` : ""),
      },
      data: slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color }, label: { color: labelOn(s.color) } })),
    }],
  };
}

// ── Chart 3: test status per module ──────────────────────────────────────────
export const STATUS_PARTS: Part[] = [
  { name: "Passed", color: C.passed, get: (r) => r.passed },
  { name: "Failed", color: C.failed, get: (r) => r.failed },
  { name: "Blocked", color: C.blocked, get: (r) => r.blocked },
  { name: "Not Tested", color: C.notTested, get: (r) => r.notTested },
];

export function chart3(ctx: ChartCtx, modules: ModuleRow[]): EChartsCoreOption {
  return stackedBars(ctx, modules, STATUS_PARTS, {
    warn: (r) => {
      const d = moduleChecks(r).statusDiff;
      return d !== 0 && r.totalTc > 0 ? `Statuses ${d > 0 ? "+" : "−"}${Math.abs(d)} vs Total TC (${fmt(r.totalTc)}); On Hold ${r.onHold}, Not an Issue ${r.notAnIssue}` : null;
    },
    empty: (r) => (r.totalTc === 0 && r.passed + r.failed + otherOf(r) === 0 ? "No TC data" : null),
  });
}

// ── Chart 4: Open vs Closed for the scope ────────────────────────────────────
export function chart4(ctx: ChartCtx): EChartsCoreOption {
  const { pal, totals: t } = ctx;
  const part = (name: string, value: number, color: string) => ({
    name, type: "bar", stack: "d", barWidth: 36, itemStyle: { color },
    label: { show: value > 0, color: labelOn(color), fontWeight: 600, formatter: () => fmt(value) },
    data: [value],
  });
  return {
    animationDuration: 300,
    grid: { left: 8, right: 70, top: 30, bottom: 4, containLabel: true },
    legend: { top: 0, left: 0, data: ["Open", "Closed"], textStyle: { color: pal.text } },
    tooltip: {
      ...tooltipBase(pal),
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: () => `Open: <b>${fmt(t.open)}</b><br/>Closed: <b>${fmt(t.closed)}</b><br/>Total: <b>${fmt(t.totalDefects)}</b>`,
    },
    xAxis: { type: "value", axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
    yAxis: { type: "category", data: ["Defects"], axisLabel: { color: pal.text }, axisTick: { show: false } },
    series: [
      part("Open", t.open, C.failed),
      part("Closed", t.closed, C.passed),
      { name: "_total", type: "bar", stack: "d", silent: true, data: [0], label: { show: true, position: "right", color: pal.muted, formatter: () => fmt(t.totalDefects) } },
    ],
  };
}

// ── Chart 5: Open vs Closed per module ───────────────────────────────────────
export const DEFECT_PARTS: Part[] = [
  { name: "Open", color: C.failed, get: (r) => r.openDefects },
  { name: "Closed", color: C.sky, get: (r) => r.closedDefects },
];

export function chart5(ctx: ChartCtx, modules: ModuleRow[]): EChartsCoreOption {
  return stackedBars(ctx, modules, DEFECT_PARTS, {
    empty: (r) => (r.openDefects + r.closedDefects === 0 ? "No defects" : null),
  });
}

// ── Chart 6: severity per module ─────────────────────────────────────────────
export const SEVERITY_PARTS: Part[] = [
  { name: "Critical", color: C.failed, get: (r) => r.sevCritical },
  { name: "High", color: C.blocked, get: (r) => r.sevHigh },
  { name: "Medium", color: C.medium, get: (r) => r.sevMedium },
  { name: "Low", color: C.sky, get: (r) => r.sevLow },
];

export function chart6(ctx: ChartCtx, modules: ModuleRow[]): EChartsCoreOption {
  return stackedBars(ctx, modules, SEVERITY_PARTS, {
    empty: (r) => (r.sevCritical + r.sevHigh + r.sevMedium + r.sevLow === 0 ? "No severities" : null),
  });
}

// ── Chart 7: priority per module ─────────────────────────────────────────────
export const PRIORITY_PARTS: Part[] = [
  { name: "High", color: C.failed, get: (r) => r.priHigh },
  { name: "Medium", color: C.blocked, get: (r) => r.priMedium },
  { name: "Low", color: C.sky, get: (r) => r.priLow },
];

export function chart7(ctx: ChartCtx, modules: ModuleRow[]): EChartsCoreOption {
  return stackedBars(ctx, modules, PRIORITY_PARTS, {
    empty: (r) => (moduleChecks(r).noPriority ? "No priority" : r.priHigh + r.priMedium + r.priLow === 0 ? "—" : null),
  });
}

// ── Chart 8: DSI per module ──────────────────────────────────────────────────
export function chart8(ctx: ChartCtx): { option: EChartsCoreOption; withDsi: ModuleRow[]; without: ModuleRow[] } {
  const { pal } = ctx;
  const scored = ctx.rows.map((r) => ({ r, d: moduleChecks(r).dsi }));
  const withDsi = scored.filter((x) => x.d !== null).sort((a, b) => b.d! - a.d!);
  const projectDsi = ctx.totals.dsi;
  const option: EChartsCoreOption = {
    animationDuration: 300,
    grid: { left: 8, right: 48, top: 24, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipBase(pal),
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (ps: { dataIndex: number }[]) => {
        const { r, d } = withDsi[ps[0].dataIndex];
        return `<b>${esc(r.module)}</b><br/>DSI: <b>${d!.toFixed(2)}</b><br/>Critical ${r.sevCritical} · High ${r.sevHigh} · Medium ${r.sevMedium} · Low ${r.sevLow}`;
      },
    },
    xAxis: { type: "value", min: 0, max: 4, interval: 1, axisLabel: { color: pal.muted }, splitLine: { lineStyle: { color: pal.grid } } },
    yAxis: {
      type: "category", inverse: true, data: withDsi.map((x) => x.r.module), triggerEvent: true,
      axisTick: { show: false }, axisLabel: { color: pal.text, width: 170, overflow: "truncate" },
    },
    series: [{
      type: "bar",
      barMaxWidth: 20,
      itemStyle: { color: pal.dsiBar },
      label: { show: true, position: "right", color: pal.text, fontSize: 11, formatter: (x: { value: number }) => x.value.toFixed(2) },
      data: withDsi.map((x) => ({ value: x.d, itemStyle: { opacity: opacity(ctx, x.r.module) } })),
      markLine: projectDsi === null ? undefined : {
        symbol: "none",
        silent: true,
        lineStyle: { color: C.sky, type: "dashed", width: 2 },
        label: { formatter: `Scope DSI ${projectDsi.toFixed(2)}`, color: pal.text, position: "end" },
        data: [{ xAxis: projectDsi }],
      },
    }],
  };
  return { option, withDsi: withDsi.map((x) => x.r), without: scored.filter((x) => x.d === null).map((x) => x.r) };
}

/** Rows for a chart's CSV download. */
export function partsCsv(modules: ModuleRow[], parts: Part[]): (string | number)[][] {
  return [["Module", ...parts.map((p) => p.name), "Total"], ...modules.map((r) => {
    const v = parts.map((p) => p.get(r));
    return [r.module, ...v, v.reduce((a, b) => a + b, 0)];
  })];
}
