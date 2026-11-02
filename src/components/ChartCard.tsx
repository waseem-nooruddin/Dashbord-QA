import { useState, type ReactNode } from "react";
import { downloadCsv } from "../lib/export";

interface Props {
  id: string;
  number: number;
  title: string;
  subtitle?: ReactNode;
  wide?: boolean;
  sort?: { value: string; options: [string, string][]; onChange: (v: string) => void };
  csv: () => (string | number | null)[][];
  footnote?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ id, number, title, subtitle, wide, sort, csv, footnote, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className={`card chart-card${wide || expanded ? " wide" : ""}`} id={id} aria-labelledby={`${id}-t`}>
      <header className="card-head">
        <div>
          <h3 id={`${id}-t`}><span className="chart-no">{number}</span>{title}</h3>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
        <div className="card-actions">
          {sort && (
            <label className="sort">
              <span className="sr-only">Sort {title}</span>
              <select value={sort.value} onChange={(e) => sort.onChange(e.target.value)}>
                {sort.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          )}
          {!wide && (
            <button className="icon-btn" onClick={() => setExpanded((x) => !x)} aria-pressed={expanded} title={expanded ? "Collapse to half width" : "Expand to full width"}>
              {expanded ? "⤡" : "⤢"}
            </button>
          )}
          <button className="icon-btn" onClick={() => downloadCsv(csv(), `chart-${number}-${title}`)} title="Download chart data as CSV">CSV</button>
        </div>
      </header>
      {children}
      {footnote && <div className="footnote">{footnote}</div>}
    </section>
  );
}
