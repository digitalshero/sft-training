import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import type { Prep, Unit, Brand, FcPrepType, FcStatus } from "@/lib/foodcost/types";
import { PREP_TYPES, fmt } from "@/lib/foodcost/types";
import {
  useFoodcostCountry,
  countryField,
  countryCurrency,
  COUNTRY_LABEL,
} from "@/lib/foodcost/country";

export function PrepsPage({ lockedType, title }: { lockedType?: FcPrepType; title?: string } = {}) {
  const { isEditor } = useRoles();
  const country = useFoodcostCountry();
  const ccy = country ? countryCurrency(country) : "inr";
  const [rows, setRows] = useState<Prep[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [costs, setCosts] = useState<Record<string, { inr: number | null; usd: number | null }>>(
    {},
  );
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<string>(lockedType ?? "all");
  const [usageF, setUsageF] = useState<"all" | "used" | "unused">("all");
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Partial<Prep> | null>(null);

  async function load() {
    let pq = api.get("/foodcost/preps", { params: { country: country ?? undefined } });
    if (country) pq = pq.eq(countryField(country), true);
    const [p, u, b, c, used] = await Promise.all([
      pq,
      api.get("/foodcost/units", { params: { country: country ?? undefined } }),
      api.get("/foodcost/brands", { params: { country: country ?? undefined } }),
      api.get("/foodcost/preps"),
      api
        .get("/foodcost/recipe-items", { params: { country: country ?? undefined } })
        .not("prep_id", "is", null),
    ]);
    if (p.error) toast.error(p.error.message);
    const prepRows = (p.data ?? []) as Array<Prep & { manually_used?: boolean }>;
    setRows(prepRows as Prep[]);
    setUnits((u.data ?? []) as Unit[]);
    setBrands((b.data ?? []) as Brand[]);
    const map: Record<string, { inr: number | null; usd: number | null }> = {};
    for (const r of (c.data ?? []) as Array<{
      prep_id: string;
      unit_cost_inr: number | null;
      unit_cost_usd: number | null;
    }>) {
      map[r.prep_id] = { inr: r.unit_cost_inr, usd: r.unit_cost_usd };
    }
    setCosts(map);
    const used4 = new Set(((used.data ?? []) as Array<{ prep_id: string }>).map((r) => r.prep_id));
    for (const r of prepRows) if (r.manually_used) used4.add(r.id);
    setUsedIds(used4);
  }
  useEffect(() => {
    load();
  }, [country]);

  const totalUnused = useMemo(() => rows.filter((r) => !usedIds.has(r.id)).length, [rows, usedIds]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const t = lockedType ?? typeF;
        if (t !== "all" && r.type !== t) return false;
        if (usageF === "used" && !usedIds.has(r.id)) return false;
        if (usageF === "unused" && usedIds.has(r.id)) return false;
        if (q && !`${r.name} ${r.code}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, q, typeF, lockedType, usageF, usedIds],
  );

  async function save() {
    if (!edit?.name?.trim() || !edit?.code?.trim() || !edit?.base_unit_id) {
      return toast.error("Code, name and base unit are required");
    }
    const payload = {
      code: edit.code.trim(),
      name: edit.name.trim(),
      type: (edit.type ?? "base") as FcPrepType,
      brand_id: edit.brand_id ?? null,
      description: edit.description ?? null,
      cuisine: edit.cuisine ?? null,
      preparation_notes: edit.preparation_notes ?? null,
      storage_notes: edit.storage_notes ?? null,
      shelf_life_days: edit.shelf_life_days ?? null,
      shelf_life_condition: edit.shelf_life_condition?.trim()
        ? edit.shelf_life_condition.trim()
        : null,
      base_unit_id: edit.base_unit_id,
      default_batch_size: edit.default_batch_size ?? null,
      default_yield_qty: edit.default_yield_qty ?? null,
      default_yield_unit_id: edit.default_yield_unit_id ?? edit.base_unit_id,
      default_wastage_pct: Number(edit.default_wastage_pct ?? 0),
      currency_mode: edit.currency_mode ?? "both",
      status: (edit.status ?? "active") as FcStatus,
      active_in: edit.active_in ?? country !== "us",
      active_us: edit.active_us ?? country === "us",
    };
    const res = edit.id
      ? await api.patch(`/foodcost/preps/${edit.id}`, payload).then((r) => r.data)
      : await api.post("/foodcost/preps", payload).then((r) => r.data);
    if (res.error) return toast.error(res.error.message);
    setEdit(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {title ?? "Pre-Preps"} {country && `(${ccy.toUpperCase()})`}
          </h1>
          <p className="text-xs text-muted-foreground">
            Internal preparation components — bases, pastes, extracts, seasonings. Not sold
            directly.
          </p>
        </div>
        {isEditor && (
          <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() =>
                  setEdit({
                    type: (lockedType ?? "base") as FcPrepType,
                    default_wastage_pct: 0,
                    currency_mode: "both",
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                New pre-prep
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{edit?.id ? "Edit pre-prep" : "New pre-prep"}</DialogTitle>
              </DialogHeader>
              {edit && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Code">
                    <Input
                      value={edit.code ?? ""}
                      onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                      placeholder="TDB"
                    />
                  </Field>
                  <Field label="Name">
                    <Input
                      value={edit.name ?? ""}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      placeholder="Toor Dal Base"
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={edit.type ?? "base"}
                      onValueChange={(v) => setEdit({ ...edit, type: v as FcPrepType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PREP_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Brand (optional)">
                    <Select
                      value={edit.brand_id ?? "none"}
                      onValueChange={(v) => setEdit({ ...edit, brand_id: v === "none" ? null : v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Shared (no brand)</SelectItem>
                        {brands.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cuisine">
                    <Input
                      value={edit.cuisine ?? ""}
                      onChange={(e) => setEdit({ ...edit, cuisine: e.target.value })}
                      placeholder="South Indian"
                    />
                  </Field>
                  <Field label="Base unit">
                    <Select
                      value={edit.base_unit_id ?? ""}
                      onValueChange={(v) =>
                        setEdit({
                          ...edit,
                          base_unit_id: v,
                          default_yield_unit_id: edit.default_yield_unit_id ?? v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.code} — {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Default batch size">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit.default_batch_size ?? ""}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          default_batch_size: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Default yield qty">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit.default_yield_qty ?? ""}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          default_yield_qty: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Yield unit">
                    <Select
                      value={edit.default_yield_unit_id ?? edit.base_unit_id ?? ""}
                      onValueChange={(v) => setEdit({ ...edit, default_yield_unit_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Default wastage %">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit.default_wastage_pct ?? 0}
                      onChange={(e) =>
                        setEdit({ ...edit, default_wastage_pct: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Shelf life (days)">
                    <Input
                      type="number"
                      value={edit.shelf_life_days ?? ""}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          shelf_life_days: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Shelf life condition">
                    <Input
                      value={edit.shelf_life_condition ?? ""}
                      onChange={(e) => setEdit({ ...edit, shelf_life_condition: e.target.value })}
                      placeholder="e.g. Stored in freezer below -4°C"
                    />
                  </Field>
                  <Field label="Region">
                    <div className="flex items-center gap-3 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!!edit.active_in}
                          onChange={(e) => setEdit({ ...edit, active_in: e.target.checked })}
                        />{" "}
                        India
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={!!edit.active_us}
                          onChange={(e) => setEdit({ ...edit, active_us: e.target.checked })}
                        />{" "}
                        USA
                      </label>
                    </div>
                  </Field>
                  <Field label="Status">
                    <Select
                      value={edit.status ?? "active"}
                      onValueChange={(v) => setEdit({ ...edit, status: v as FcStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="col-span-2">
                    <Field label="Description">
                      <Input
                        value={edit.description ?? ""}
                        onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Preparation notes">
                      <Input
                        value={edit.preparation_notes ?? ""}
                        onChange={(e) => setEdit({ ...edit, preparation_notes: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Storage notes">
                      <Input
                        value={edit.storage_notes ?? ""}
                        onChange={(e) => setEdit({ ...edit, storage_notes: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="col-span-2 flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setEdit(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={save}>
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Input
          placeholder="Search code or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 w-60"
        />
        {!lockedType && (
          <Select value={typeF} onValueChange={setTypeF}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {PREP_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={usageF} onValueChange={(v) => setUsageF(v as "all" | "used" | "unused")}>
          <SelectTrigger className="h-8 w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All usage</SelectItem>
            <SelectItem value="used">Used in recipes</SelectItem>
            <SelectItem value="unused">
              {country
                ? `Unused in ${COUNTRY_LABEL[country]} (${totalUnused})`
                : `Unused (${totalUnused})`}
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} preps</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadPrepsPDF(filtered, units, brands, costs, ccy, country, lockedType ?? typeF)
          }
        >
          <FileDown className="mr-1 h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>

      <PrepsStats rows={filtered} costs={costs} ccy={ccy} q={q} typeF={lockedType ?? typeF} />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-right">Yield</th>
              <th className="px-3 py-2 text-right">Wastage</th>
              <th className="px-3 py-2 text-right">Cost / base unit</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No pre-preps yet.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const baseUnit = units.find((u) => u.id === r.base_unit_id);
              const yieldUnit = units.find(
                (u) => u.id === (r.default_yield_unit_id ?? r.base_unit_id),
              );
              const brand = brands.find((b) => b.id === r.brand_id);
              const cost = costs[r.id];
              const unitCost = ccy === "inr" ? cost?.inr : cost?.usd;
              return (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2">
                    <Link
                      to="/foodcost/preps/$id"
                      params={{ id: r.id }}
                      className="hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {PREP_TYPES.find((t) => t.value === r.type)?.label}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{brand?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {r.default_yield_qty ?? "—"} {yieldUnit?.code}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {Number(r.default_wastage_pct).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {unitCost == null ? "—" : `${fmt(Number(unitCost), ccy)} / ${baseUnit?.code}`}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-right">
                    {isEditor && (
                      <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isEditor && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (!confirm(`Delete pre-prep "${r.name}"? This cannot be undone.`))
                            return;
                          const { error } = await api
                            .delete(`/foodcost/preps/${r.id}`)
                            .then((r) => r.data);
                          if (error) return toast.error(error.message);
                          toast.success("Deleted");
                          load();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function downloadPrepsPDF(
  rows: Prep[],
  units: Unit[],
  brands: Brand[],
  costs: Record<string, { inr: number | null; usd: number | null }>,
  ccy: "inr" | "usd",
  country: string | null | undefined,
  typeF: string,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const sym = ccy === "inr" ? "INR" : "USD";
  const regionLabel = country ? (country === "us" ? "USA" : "India") : "All";
  const typeLabel =
    typeF === "all" ? "All Types" : (PREP_TYPES.find((t) => t.value === typeF)?.label ?? typeF);
  doc.setFontSize(14);
  doc.text(`Pre-Preps — ${regionLabel} (${sym})`, 40, 36);
  doc.setFontSize(9);
  doc.text(
    `Filter: ${typeLabel}  ·  ${rows.length} preps  ·  ${new Date().toLocaleDateString()}`,
    40,
    52,
  );

  const body = rows.map((r) => {
    const baseUnit = units.find((u) => u.id === r.base_unit_id);
    const yieldUnit = units.find((u) => u.id === (r.default_yield_unit_id ?? r.base_unit_id));
    const brand = brands.find((b) => b.id === r.brand_id);
    const cost = costs[r.id];
    const unitCost = ccy === "inr" ? cost?.inr : cost?.usd;
    return [
      r.code,
      r.name,
      PREP_TYPES.find((t) => t.value === r.type)?.label ?? r.type,
      brand?.name ?? "—",
      r.default_yield_qty != null ? `${r.default_yield_qty} ${yieldUnit?.code ?? ""}` : "—",
      `${Number(r.default_wastage_pct ?? 0).toFixed(1)}%`,
      unitCost == null ? "—" : `${fmt(Number(unitCost), ccy)} / ${baseUnit?.code ?? ""}`,
      r.status,
    ];
  });

  autoTable(doc, {
    startY: 64,
    head: [["Code", "Name", "Type", "Brand", "Yield", "Wastage", "Cost / base unit", "Status"]],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255 },
    columnStyles: { 0: { cellWidth: 60 }, 6: { halign: "right" } },
  });

  doc.save(`pre-preps-${country ?? "all"}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function PrepsStats({
  rows,
  costs,
  ccy,
  q,
  typeF,
}: {
  rows: Prep[];
  costs: Record<string, { inr: number | null; usd: number | null }>;
  ccy: "inr" | "usd";
  q: string;
  typeF: string;
}) {
  const byType = new Map<string, number>();
  let withCost = 0,
    withoutCost = 0,
    active = 0,
    inactive = 0;
  const prices: number[] = [];
  for (const r of rows) {
    byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
    if (r.status === "active") active++;
    else inactive++;
    const c = costs[r.id];
    const v = ccy === "inr" ? c?.inr : c?.usd;
    if (v != null && Number(v) > 0) {
      withCost++;
      prices.push(Number(v));
    } else withoutCost++;
  }
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;
  const filtersLabel = `Type: ${typeF === "all" ? "All" : (PREP_TYPES.find((t) => t.value === typeF)?.label ?? typeF)}${q ? ` · Search: "${q}"` : ""}`;
  const sym = ccy === "inr" ? "₹" : "$";
  const f = (n: number) => `${sym}${n.toFixed(2)}`;

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3 text-xs print:break-inside-avoid">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-medium text-sm">Stats (filtered)</span>
        <span className="text-muted-foreground">{filtersLabel}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <StatCell label="Total preps" value={rows.length} />
        <StatCell label="Active / Inactive" value={`${active} / ${inactive}`} />
        <StatCell label="With cost / Without" value={`${withCost} / ${withoutCost}`} />
        <StatCell
          label={`Cost ${ccy.toUpperCase()} (avg · min · max)`}
          value={prices.length ? `${f(avg)} · ${f(min)} · ${f(max)}` : "—"}
        />
      </div>
      {byType.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from(byType.entries()).map(([k, v]) => (
            <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
              {PREP_TYPES.find((t) => t.value === k)?.label ?? k}: <b>{v}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}
