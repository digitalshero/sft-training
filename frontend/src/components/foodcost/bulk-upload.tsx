import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export type BulkColumn<R> = {
  key: keyof R & string;
  label: string;
  required?: boolean;
  example?: string | number;
  /** Optional cell validator → returns error message, or null/undefined if OK */
  validate?: (value: unknown, row: Partial<R>) => string | null | undefined;
  /** Optional transform raw cell → final value (e.g., resolve name→id) */
  transform?: (value: unknown, row: Partial<R>) => unknown;
};

export type BulkUploadProps<R extends Record<string, unknown>> = {
  /** Filename + sheet name + title */
  entity: string;
  columns: BulkColumn<R>[];
  /** Async commit of validated rows → returns inserted count. Throw to fail. */
  onCommit: (
    rows: R[],
  ) => Promise<{ inserted: number; failed?: { row: R; error: string }[] }>;
  /** Called after successful commit to refresh parent */
  onDone?: () => void;
  /** Helper text shown above template */
  hint?: string;
  /** Button label, defaults to "Bulk upload" */
  triggerLabel?: string;
};

type ParsedRow<R> = {
  idx: number;
  raw: Record<string, unknown>;
  data: Partial<R>;
  errors: string[];
};

function makeTemplateRows<R extends Record<string, unknown>>(
  cols: BulkColumn<R>[],
) {
  const header = cols.map((c) => c.label + (c.required ? " *" : ""));
  const example = cols.map((c) => c.example ?? "");
  return { header, example };
}

function downloadCSV<R extends Record<string, unknown>>(
  entity: string,
  cols: BulkColumn<R>[],
) {
  const { header, example } = makeTemplateRows(cols);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header.map(esc).join(","), example.map(esc).join(",")].join(
    "\n",
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerBlobDownload(blob, `${entity}-template.csv`);
}

function downloadXLSX<R extends Record<string, unknown>>(
  entity: string,
  cols: BulkColumn<R>[],
) {
  const { header, example } = makeTemplateRows(cols);
  const ws = XLSX.utils.aoa_to_sheet([header, example]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, entity.slice(0, 28));
  XLSX.writeFile(wb, `${entity}-template.xlsx`);
}

function triggerBlobDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
}

function normaliseHeaderKey(s: string) {
  return s
    .toLowerCase()
    .replace(/\s*\*\s*$/, "")
    .trim();
}

export function BulkUpload<R extends Record<string, unknown>>(
  props: BulkUploadProps<R>,
) {
  const {
    entity,
    columns,
    onCommit,
    onDone,
    hint,
    triggerLabel = "Bulk upload",
  } = props;
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow<R>[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setParsed(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    try {
      const raw = await parseFile(file);
      if (!raw.length) {
        toast.error("File is empty");
        return;
      }
      // Build a label-key map for case-insensitive header matching
      const labelToKey = new Map<string, keyof R & string>();
      columns.forEach((c) =>
        labelToKey.set(normaliseHeaderKey(c.label), c.key),
      );
      const rows: ParsedRow<R>[] = raw.map((rawRow, idx) => {
        const data: Partial<R> = {};
        for (const [headerLabel, cellVal] of Object.entries(rawRow)) {
          const k = labelToKey.get(normaliseHeaderKey(headerLabel));
          if (k) (data as Record<string, unknown>)[k] = cellVal;
        }
        const errors: string[] = [];
        for (const col of columns) {
          let v = (data as Record<string, unknown>)[col.key];
          if (col.transform) {
            try {
              v = col.transform(v, data);
              (data as Record<string, unknown>)[col.key] = v;
            } catch (e) {
              errors.push(`${col.label}: ${(e as Error).message}`);
              continue;
            }
          }
          const empty = v === "" || v == null;
          if (col.required && empty) errors.push(`${col.label} is required`);
          if (!empty && col.validate) {
            const msg = col.validate(v, data);
            if (msg) errors.push(`${col.label}: ${msg}`);
          }
        }
        return { idx, raw: rawRow, data, errors };
      });
      setParsed(rows);
    } catch (e) {
      toast.error(`Could not read file: ${(e as Error).message}`);
    }
  }

  async function commit() {
    if (!parsed) return;
    const valid = parsed
      .filter((r) => r.errors.length === 0)
      .map((r) => r.data as R);
    if (!valid.length) {
      toast.error("No valid rows to import");
      return;
    }
    setBusy(true);
    try {
      const { inserted, failed } = await onCommit(valid);
      toast.success(
        failed?.length
          ? `Imported ${inserted} ${entity}, ${failed.length} failed`
          : `Imported ${inserted} ${entity}`,
      );
      if (failed?.length) console.warn("Bulk import failures", failed);
      setOpen(false);
      reset();
      onDone?.();
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const validCount = parsed?.filter((r) => !r.errors.length).length ?? 0;
  const errorCount = parsed?.filter((r) => r.errors.length).length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk upload — {entity}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <Download className="mr-2 h-4 w-4" />
                  Download template
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => downloadCSV(entity, columns)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  CSV (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadXLSX(entity, columns)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && handleFile(e.target.files[0])
              }
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Choose file…
            </Button>
            <span className="text-xs text-muted-foreground">
              Required columns marked with *
            </span>
          </div>

          {parsed && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  {validCount} valid
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-500">
                    <AlertCircle className="h-4 w-4" />
                    {errorCount} with errors (will be skipped)
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface-elevated text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="w-10 px-2 py-1 text-left">Row</th>
                      {columns.map((c) => (
                        <th key={c.key} className="px-2 py-1 text-left">
                          {c.label}
                        </th>
                      ))}
                      <th className="px-2 py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((r) => (
                      <tr
                        key={r.idx}
                        className={`border-t border-border/40 ${r.errors.length ? "bg-amber-500/5" : ""}`}
                      >
                        <td className="px-2 py-1 text-muted-foreground">
                          {r.idx + 2}
                        </td>
                        {columns.map((c) => (
                          <td
                            key={c.key}
                            className="max-w-45 truncate px-2 py-1"
                            title={String(
                              (r.data as Record<string, unknown>)[c.key] ?? "",
                            )}
                          >
                            {String(
                              (r.data as Record<string, unknown>)[c.key] ?? "",
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-1">
                          {r.errors.length ? (
                            <span className="text-amber-500">
                              {r.errors.join("; ")}
                            </span>
                          ) : (
                            <span className="text-emerald-500">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={reset}>
                  Clear
                </Button>
                <Button onClick={commit} disabled={busy || validCount === 0}>
                  {busy
                    ? "Importing…"
                    : `Import ${validCount} row${validCount === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
