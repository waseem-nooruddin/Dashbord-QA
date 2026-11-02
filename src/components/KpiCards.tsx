import type { Totals } from "../lib/calc";

const fmt = (n: number) => n.toLocaleString("en-US");

export function KpiCards({ t }: { t: Totals }) {
  const cards = [
    { label: "Total TC", value: fmt(t.totalTc), sub: `${fmt(t.executed)} executed · ${t.modules} module${t.modules === 1 ? "" : "s"}`, tone: "navy" },
    { label: "Test Cases Passed", value: fmt(t.passed), sub: `${fmt(t.failed)} failed · ${fmt(t.blocked)} blocked`, tone: "green" },
    { label: "Total Open Defects", value: fmt(t.open), sub: `${fmt(t.closed)} closed · ${fmt(t.totalDefects)} total`, tone: "red" },
    { label: "Test Pass Ratio", value: t.passRatio === null ? "—" : `${(t.passRatio * 100).toFixed(1)}%`, sub: "Passed ÷ Total TC", tone: "sky" },
  ];
  return (
    <section className="kpis" aria-label="Key figures">
      {cards.map((c) => (
        <div key={c.label} className={`card kpi kpi-${c.tone}`}>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-sub">{c.sub}</div>
        </div>
      ))}
    </section>
  );
}
