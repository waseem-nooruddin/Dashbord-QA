import { useMemo, useState } from "react";
import type { ModuleRow } from "../lib/adapter";
import { exportTableCsv, exportTablePdf, exportTableXlsx, type ReportMeta } from "../lib/export";
import { buildTable, COLUMNS, formatCell, GROUP_LABELS, type Column, type ColumnGroup, type TableRow } from "../lib/table";

interface Props {
  rows: ModuleRow[];
  totalLabel: string;
  meta: ReportMeta;
  focused: string | null;
  onSelect: (module: string) => void;
}

type Toggleable = Exclude<ColumnGroup, "base">;

export function DetailedTable({ rows, totalLabel, meta, focused, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null);
  const [groups, setGroups] = useState<Record<Toggleable, boolean>>({ outcomes: true, defects: true, severity: false, priority: false, ratios: false });
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const cols = COLUMNS.filter((c) => c.group === "base" || groups[c.group]);
  const { body, total } = useMemo(() => buildTable(rows, totalLabel), [rows, totalLabel]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? body.filter((r) => r.name.toLowerCase().includes(q)) : body;
    if (sort) {
      const col = COLUMNS.find((c) => c.key === sort.key)!;
      list = [...list].sort((a, b) => {
        const x = col.value(a), y = col.value(b);
        const cmp = typeof x === "number" && typeof y === "number" ? x - y
          : x === null ? 1 : y === null ? -1 : String(x).localeCompare(String(y));
        return sort.asc ? cmp : -cmp;
      });
    }
    return list;
  }, [body, query, sort]);

  const toggleSort = (c: Column) =>
    setSort((s) => (s?.key === c.key ? (s.asc ? { key: c.key, asc: false } : null) : { key: c.key, asc: c.kind === "text" }));

  const exportRows: TableRow[] = [...visible, total];
  const run = async (kind: string, fn: () => unknown) => {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); }
  };

  return (
    <section className="card table-card" id="detailed-table" aria-labelledby="dt-title">
      <header className="card-head table-head">
        <div>
          <h3 id="dt-title">Overall Detailed Table</h3>
          <p className="card-sub">{visible.length} of {body.length} modules · click a row to focus the dashboard on it</p>
        </div>
        <div className="card-actions table-actions">
          <label className="search">
            <span className="sr-only">Search modules</span>
            <input type="search" placeholder="Search modules" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="menu-wrap">
            <button className="btn" aria-expanded={menu} aria-haspopup="true" onClick={() => setMenu((m) => !m)}>Columns ▾</button>
            {menu && (
              <div className="menu" role="group" aria-label="Column groups">
                {(Object.keys(GROUP_LABELS) as Toggleable[]).map((g) => (
                  <label key={g} className="menu-item">
                    <input type="checkbox" checked={groups[g]} onChange={() => setGroups((x) => ({ ...x, [g]: !x[g] }))} />
                    {GROUP_LABELS[g]}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="btn" disabled={!!busy} onClick={() => run("xlsx", () => exportTableXlsx(cols, exportRows, meta))}>{busy === "xlsx" ? "…" : "Excel"}</button>
          <button className="btn" disabled={!!busy} onClick={() => run("csv", () => exportTableCsv(cols, exportRows, meta))}>CSV</button>
          <button className="btn" disabled={!!busy} onClick={() => run("pdf", () => exportTablePdf(cols, exportRows, meta))}>{busy === "pdf" ? "…" : "PDF"}</button>
        </div>
      </header>
      <div className="table-scroll" tabIndex={0} aria-label="Detailed table, scrollable">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} scope="col" className={c.kind === "text" ? "" : "num"}
                  aria-sort={sort?.key === c.key ? (sort.asc ? "ascending" : "descending") : "none"}>
                  <button className="th-btn" onClick={() => toggleSort(c)}>
                    {c.label}{sort?.key === c.key ? (sort.asc ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.name} className={r.name === focused ? "focused" : ""}>
                {cols.map((c, i) => {
                  const v = c.value(r);
                  const text = formatCell(c, v);
                  const cls = [c.kind === "text" ? "" : "num", c.key === "validation" ? (text.startsWith("⚠") ? "warn" : text.startsWith("✓") ? "ok" : "muted") : ""].join(" ").trim();
                  return i === 0
                    ? <th key={c.key} scope="row"><button className="row-btn" onClick={() => onSelect(r.name)}>{text}</button></th>
                    : <td key={c.key} className={cls}>{text}</td>;
                })}
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={cols.length} className="muted center">No modules match “{query}”.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="total-row">
              {cols.map((c, i) => {
                const text = formatCell(c, c.value(total));
                return i === 0 ? <th key={c.key} scope="row">{text}</th> : <td key={c.key} className={c.kind === "text" ? "" : "num"}>{text}</td>;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
