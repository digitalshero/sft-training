import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn<T> = {
  key: string;
  label: string;
  get?: (row: T) => unknown;
};

function valueOf<T>(row: T, col: ExportColumn<T>): unknown {
  if (col.get) return col.get(row);
  return (row as Record<string, unknown>)[col.key];
}

function toMatrix<T>(rows: T[], cols: ExportColumn<T>[]) {
  const head = cols.map((c) => c.label);
  const body = rows.map((r) =>
    cols.map((c) => {
      const v = valueOf(r, c);
      if (v == null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return v as string | number | boolean;
    }),
  );
  return { head, body };
}

export function exportCSV<T>(filename: string, rows: T[], cols: ExportColumn<T>[]) {
  const { head, body } = toMatrix(rows, cols);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [head.map(escape).join(","), ...body.map((row) => row.map(escape).join(","))].join(
    "\n",
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `${filename}.csv`);
}

export function exportXLSX<T>(filename: string, rows: T[], cols: ExportColumn<T>[]) {
  const { head, body } = toMatrix(rows, cols);
  const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPDF<T>(filename: string, title: string, rows: T[], cols: ExportColumn<T>[]) {
  const { head, body } = toMatrix(rows, cols);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(title, 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleString(), 40, 52);
  autoTable(doc, {
    head: [head],
    body: body as (string | number | boolean)[][],
    startY: 64,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [20, 20, 20] },
    margin: { left: 24, right: 24 },
  });
  doc.save(`${filename}.pdf`);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
