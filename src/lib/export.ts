// Excel, CSV and PDF exports (FR-43, FR-44, FR-30). Heavy libraries load on demand.
import { formatCell, type Column, type TableRow } from "./table";

export interface ReportMeta {
  reportName: string;
  scope: string;
  source: string;
  lastSync: string;
}

type Cell = string | number | null;

/** Quotes text cells and defuses spreadsheet formulas (= + - @, tab, CR) in them. */
export function csvEscape(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

function metaRows(m: ReportMeta): Cell[][] {
  return [
    ["Report", m.reportName],
    ["Scope", m.scope],
    ["Source", m.source],
    ["Last sync", m.lastSync],
    ["Generated", new Date().toLocaleString()],
    [],
  ];
}

function rawValue(c: Column, r: TableRow): Cell {
  const v = c.value(r);
  if (typeof v === "number" && c.kind === "pct") return Math.round(v * 10000) / 100;
  if (typeof v === "number" && c.kind === "dsi") return Math.round(v * 100) / 100;
  return v;
}

function header(cols: Column[]) {
  return cols.map((c) => (c.kind === "pct" ? `${c.label} (%)` : c.label));
}

export function downloadCsv(rows: Cell[][], name: string) {
  download(new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" }), `${slug(name)}-${stamp()}.csv`);
}

export function exportTableCsv(cols: Column[], rows: TableRow[], m: ReportMeta) {
  downloadCsv([...metaRows(m), header(cols), ...rows.map((r) => cols.map((c) => rawValue(c, r)))], `${m.reportName} ${m.scope}`);
}

export async function exportTableXlsx(cols: Column[], rows: TableRow[], m: ReportMeta) {
  const XLSX = await import("xlsx");
  const aoa = [...metaRows(m), header(cols), ...rows.map((r) => cols.map((c) => rawValue(c, r)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = cols.map((c) => ({ wch: c.key === "module" ? 32 : Math.max(10, c.label.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Detailed Table");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${slug(m.reportName + " " + m.scope)}-${stamp()}.xlsx`);
}

export async function exportTablePdf(cols: Column[], rows: TableRow[], m: ReportMeta) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(m.reportName, 10, 12);
  doc.setFontSize(9);
  doc.text(`Scope: ${m.scope}   ·   Source: ${m.source}`, 10, 18);
  doc.text(`Last sync: ${m.lastSync}   ·   Generated: ${new Date().toLocaleString()}`, 10, 23);
  // jsPDF's standard fonts lack ✓ ⚠ −, so swap them for plain text.
  const plain = (s: string) => s.replace("✓", "OK").replace("⚠", "!").replace("−", "-");
  autoTable(doc, {
    startY: 27,
    head: [cols.map((c) => c.label)],
    body: rows.map((r) => cols.map((c) => plain(formatCell(c, c.value(r))))),
    styles: { fontSize: cols.length > 14 ? 5.5 : 7, cellPadding: 1 },
    headStyles: { fillColor: [11, 40, 88] },
    didParseCell: (d) => {
      if (d.section === "body" && rows[d.row.index]?.isTotal) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [224, 242, 254];
      }
    },
    margin: { left: 8, right: 8 },
  });
  doc.save(`${slug(m.reportName + " " + m.scope)}-${stamp()}.pdf`);
}
