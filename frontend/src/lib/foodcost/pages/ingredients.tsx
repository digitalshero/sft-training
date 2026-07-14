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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  FileDown,
  Trash2,
  ShoppingBag,
  ShoppingCart,
  Leaf,
  Flame,
  Droplet,
  Milk,
  Package,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import type { Ingredient, Unit, FcIngredientCategory, FcStatus } from "@/lib/foodcost/types";
import { INGREDIENT_CATEGORIES } from "@/lib/foodcost/types";
import { useFoodcostCountry, COUNTRY_LABEL, countryField } from "@/lib/foodcost/country";
import { BulkUpload, type BulkColumn } from "@/components/foodcost/bulk-upload";
import { StatusPill } from "./brands";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type CatStyle = {
  icon: LucideIcon;
  tint: string;
  bg: string;
  border: string;
  iconBg: string;
  ring: string;
};
const CAT_STYLE: Record<string, CatStyle> = {
  total: {
    icon: ShoppingBag,
    tint: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconBg: "bg-emerald-700",
    ring: "ring-emerald-600",
  },
  grocery: {
    icon: ShoppingCart,
    tint: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    iconBg: "bg-teal-500",
    ring: "ring-teal-500",
  },
  vegetable: {
    icon: Leaf,
    tint: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    iconBg: "bg-green-500",
    ring: "ring-green-500",
  },
  spice: {
    icon: Flame,
    tint: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    iconBg: "bg-orange-500",
    ring: "ring-orange-500",
  },
  oil: {
    icon: Droplet,
    tint: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconBg: "bg-amber-500",
    ring: "ring-amber-500",
  },
  dairy: {
    icon: Milk,
    tint: "text-teal-700",
    bg: "bg-teal-50/60",
    border: "border-teal-200",
    iconBg: "bg-teal-400",
    ring: "ring-teal-400",
  },
  packing: {
    icon: Package,
    tint: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconBg: "bg-emerald-600",
    ring: "ring-emerald-600",
  },
  other: {
    icon: MoreHorizontal,
    tint: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    iconBg: "bg-slate-400",
    ring: "ring-slate-400",
  },
};

export function IngredientsPage() {
  const { isEditor } = useRoles();
  const country = useFoodcostCountry();
  const [rows, setRows] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [edit, setEdit] = useState<Partial<Ingredient> | null>(null);
  const [history, setHistory] = useState<{ ing: Ingredient; rows: PriceHistoryRow[] } | null>(null);
  const [q, setQ] = useState("");
  const [catF, setCatF] = useState<string>("all");
  const [usageF, setUsageF] = useState<"all" | "used" | "unused">("all");
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

  async function load() {
    let iq = api.get("/foodcost/ingredients", { params: { country: country ?? undefined } });
    if (country) iq = iq.eq(countryField(country), true);
    const [i, u, ri] = await Promise.all([
      iq,
      api.get("/foodcost/units", { params: { country: country ?? undefined } }),
      api.get("/foodcost/recipe-items", { params: { country: country ?? undefined } }),
    ]);
    if (i.error) toast.error(i.error.message);
    const ingRows = (i.data ?? []) as (Ingredient & { manually_used?: boolean })[];
    setRows(ingRows);
    setUnits((u.data ?? []) as Unit[]);
    const used = new Set(
      (ri.data ?? [])
        .map((r: { ingredient_id: string | null }) => r.ingredient_id)
        .filter(Boolean) as string[],
    );
    for (const ing of ingRows) if (ing.manually_used) used.add(ing.id);
    setUsedIds(used);
  }
  useEffect(() => {
    load();
  }, [country]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (catF !== "all" && r.category !== catF) return false;
        if (usageF === "used" && !usedIds.has(r.id)) return false;
        if (usageF === "unused" && usedIds.has(r.id)) return false;
        if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, q, catF, usageF, usedIds],
  );

  const unusedCount = useMemo(() => rows.filter((r) => !usedIds.has(r.id)).length, [rows, usedIds]);

  async function openHistory(ing: Ingredient) {
    setHistory({ ing, rows: [] });
    const { data, error } = await api
      .get("/foodcost/fc-ingredient-price-history")
      .then((r) => r.data);
    if (error) return toast.error(error.message);
    const userIds = Array.from(
      new Set((data ?? []).map((r) => r.changed_by).filter(Boolean) as string[]),
    );
    let nameMap: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await api.get("/admin/users").in("id", userIds);
      nameMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name ?? ""]));
    }
    const rows = (data ?? []).map((r) => ({
      ...r,
      changed_by_name: r.changed_by ? (nameMap[r.changed_by] ?? null) : null,
    })) as PriceHistoryRow[];
    setHistory({ ing, rows });
  }

  async function save() {
    if (!edit?.name?.trim() || !edit?.base_unit_id) return toast.error("Name and unit required");
    const payload = {
      name: edit.name,
      category: (edit.category ?? "other") as FcIngredientCategory,
      base_unit_id: edit.base_unit_id,
      price_inr: Number(edit.price_inr ?? 0),
      price_usd: Number(edit.price_usd ?? 0),
      status: (edit.status ?? "active") as FcStatus,
      active_in: edit.active_in ?? country !== "us",
      active_us: edit.active_us ?? country === "us",
      kcal_per_100: Number(edit.kcal_per_100 ?? 0),
      protein_g_per_100: Number(edit.protein_g_per_100 ?? 0),
      carbs_g_per_100: Number(edit.carbs_g_per_100 ?? 0),
      fat_g_per_100: Number(edit.fat_g_per_100 ?? 0),
      fibre_g_per_100: Number(edit.fibre_g_per_100 ?? 0),
      is_animal_origin: !!edit.is_animal_origin,
    };
    const { error } = edit.id
      ? await api.patch(`/foodcost/ingredients/${edit.id}`, payload).then((r) => r.data)
      : await api.post("/foodcost/ingredients", payload).then((r) => r.data);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEdit(null);
    load();
  }

  const statBase = useMemo(
    () =>
      rows.filter((r) => {
        if (usageF === "used" && !usedIds.has(r.id)) return false;
        if (usageF === "unused" && usedIds.has(r.id)) return false;
        if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, usageF, usedIds, q],
  );
  const catStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of statBase) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    return INGREDIENT_CATEGORIES.map((c) => ({ ...c, count: counts.get(c.value) ?? 0 }));
  }, [statBase]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-elevated p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ingredients by category
          </h3>
          <span className="text-xs text-muted-foreground">
            Total categories:{" "}
            <span className="font-semibold text-foreground tabular-nums">{catStats.length}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {(() => {
            const items: {
              key: string;
              label: string;
              count: number;
              active: boolean;
              onClick: () => void;
            }[] = [
              {
                key: "total",
                label: "Total items",
                count: statBase.length,
                active: catF === "all",
                onClick: () => setCatF("all"),
              },
              ...catStats.map((c) => ({
                key: c.value,
                label: c.label,
                count: c.count,
                active: catF === c.value,
                onClick: () => setCatF(catF === c.value ? "all" : c.value),
              })),
            ];
            return items.map((item) => {
              const s = CAT_STYLE[item.key] ?? CAT_STYLE.other;
              const Icon = s.icon;
              return (
                <button
                  key={item.key}
                  onClick={item.onClick}
                  className={`group rounded-2xl border ${s.border} ${s.bg} p-3 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${item.active ? `ring-2 ${s.ring} ring-offset-1` : ""}`}
                >
                  <div
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${s.iconBg} text-white shadow-sm transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div
                    className={`mt-2 text-[11px] font-semibold uppercase tracking-wide ${s.tint}`}
                  >
                    {item.label}
                  </div>
                  <div className={`mt-0.5 text-2xl font-bold tabular-nums ${s.tint}`}>
                    {item.count}
                  </div>
                </button>
              );
            });
          })()}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-semibold mr-auto">
          Ingredient Master{" "}
          {country && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — {COUNTRY_LABEL[country]}
            </span>
          )}
        </h2>
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        <Select value={catF} onValueChange={setCatF}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {INGREDIENT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={usageF} onValueChange={(v) => setUsageF(v as "all" | "used" | "unused")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All usage{country ? ` (${COUNTRY_LABEL[country]})` : ""}
            </SelectItem>
            <SelectItem value="used">
              Used in recipes{country ? ` (${COUNTRY_LABEL[country]})` : ""}
            </SelectItem>
            <SelectItem value="unused">
              Unused {country ? `in ${COUNTRY_LABEL[country]} ` : ""}({unusedCount})
            </SelectItem>
          </SelectContent>
        </Select>
        {isEditor && <IngredientBulk units={units} country={country} onDone={load} />}
        {isEditor && (
          <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
            <DialogTrigger asChild>
              <Button
                onClick={() =>
                  setEdit({ status: "active", category: "other", price_inr: 0, price_usd: 0 })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                New ingredient
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{edit?.id ? "Edit ingredient" : "New ingredient"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <Input
                    value={edit?.name ?? ""}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </Field>
                <Field label="Category">
                  <Select
                    value={edit?.category ?? "other"}
                    onValueChange={(v) => setEdit({ ...edit, category: v as FcIngredientCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INGREDIENT_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Base unit">
                  <Select
                    value={edit?.base_unit_id ?? ""}
                    onValueChange={(v) => setEdit({ ...edit, base_unit_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
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
                <Field label="Status">
                  <Select
                    value={edit?.status ?? "active"}
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
                <Field label="Price per base unit (INR)">
                  <Input
                    type="number"
                    step="0.01"
                    value={edit?.price_inr ?? 0}
                    onChange={(e) => setEdit({ ...edit, price_inr: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Price per base unit (USD)">
                  <Input
                    type="number"
                    step="0.0001"
                    value={edit?.price_usd ?? 0}
                    onChange={(e) => setEdit({ ...edit, price_usd: Number(e.target.value) })}
                  />
                </Field>

                <div className="col-span-2 mt-2 border-t border-border pt-3">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Nutrition (per 100g / 100ml)
                    </h4>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={!!edit?.is_animal_origin}
                          onChange={(e) => setEdit({ ...edit, is_animal_origin: e.target.checked })}
                        />
                        <span>Animal-origin (non-veg)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={!!edit?.is_dairy}
                          onChange={(e) => setEdit({ ...edit, is_dairy: e.target.checked })}
                        />
                        <span>Dairy (breaks Vegan tag)</span>
                      </label>
                    </div>
                  </div>
                </div>
                <Field label="Calories (kcal)">
                  <Input
                    type="number"
                    step="0.1"
                    value={edit?.kcal_per_100 ?? 0}
                    onChange={(e) => setEdit({ ...edit, kcal_per_100: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Protein (g)">
                  <Input
                    type="number"
                    step="0.1"
                    value={edit?.protein_g_per_100 ?? 0}
                    onChange={(e) =>
                      setEdit({ ...edit, protein_g_per_100: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Carbs (g)">
                  <Input
                    type="number"
                    step="0.1"
                    value={edit?.carbs_g_per_100 ?? 0}
                    onChange={(e) => setEdit({ ...edit, carbs_g_per_100: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Fat (g)">
                  <Input
                    type="number"
                    step="0.1"
                    value={edit?.fat_g_per_100 ?? 0}
                    onChange={(e) => setEdit({ ...edit, fat_g_per_100: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Fibre (g)">
                  <Input
                    type="number"
                    step="0.1"
                    value={edit?.fibre_g_per_100 ?? 0}
                    onChange={(e) => setEdit({ ...edit, fibre_g_per_100: Number(e.target.value) })}
                  />
                </Field>

                <div className="col-span-2 text-xs text-muted-foreground">
                  Tip: for major price changes use the <b>Price Updates</b> tab to log a reason and
                  notify CPO.
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button onClick={save}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <Button variant="outline" onClick={() => downloadChecklistPdf(filtered, units, country)}>
          <FileDown className="mr-2 h-4 w-4" />
          Download checklist PDF
        </Button>
        <Button variant="outline" onClick={() => downloadSpecExcel(filtered, units, country)}>
          <FileDown className="mr-2 h-4 w-4" />
          Spec Excel
        </Button>
        <Button variant="outline" onClick={() => downloadSpecPdf(filtered, units, country)}>
          <FileDown className="mr-2 h-4 w-4" />
          Spec PDF
        </Button>
      </div>
      <div className="rounded-2xl border border-border bg-surface-elevated">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Ingredient</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Unit</th>
              {country !== "us" && <th className="px-4 py-2 text-right">INR / unit</th>}
              {country !== "in" && <th className="px-4 py-2 text-right">USD / unit</th>}
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No ingredients.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const unitCode = units.find((u) => u.id === r.base_unit_id)?.code ?? "";
              return (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {INGREDIENT_CATEGORIES.find((c) => c.value === r.category)?.label}
                  </td>
                  <td className="px-4 py-2 text-xs font-medium uppercase">
                    {unitCode === "l" ? "L" : unitCode}
                  </td>
                  {country !== "us" && (
                    <td className="px-4 py-2 text-right tabular-nums">
                      ₹{Number(r.price_inr).toFixed(2)}
                    </td>
                  )}
                  {country !== "in" && (
                    <td className="px-4 py-2 text-right tabular-nums">
                      ${Number(r.price_usd).toFixed(4)}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <StatusPill s={r.status} />
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <button
                      className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      onClick={() => openHistory(r)}
                    >
                      {new Date(r.last_updated_at).toLocaleDateString()}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isEditor && (
                      <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {isEditor && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (!confirm(`Delete ingredient "${r.name}"? This cannot be undone.`))
                            return;
                          const { error } = await api
                            .delete(`/foodcost/ingredients/${r.id}`)
                            .then((r) => r.data);
                          if (error) return toast.error(error.message);
                          toast.success("Deleted");
                          load();
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <HistorySheet country={country} state={history} onClose={() => setHistory(null)} />
    </div>
  );
}

type PriceHistoryRow = {
  id: string;
  currency: "inr" | "usd";
  old_price: number;
  new_price: number;
  reason: string | null;
  changed_at: string;
  changed_by: string | null;
  changed_by_name?: string | null;
};

function HistorySheet({
  country,
  state,
  onClose,
}: {
  country: ReturnType<typeof useFoodcostCountry>;
  state: { ing: Ingredient; rows: PriceHistoryRow[] } | null;
  onClose: () => void;
}) {
  const rows = state?.rows ?? [];
  const filtered = country
    ? rows.filter((r) => r.currency === (country === "us" ? "usd" : "inr"))
    : rows;
  const sym = (c: string) => (c === "inr" ? "₹" : "$");
  return (
    <Sheet open={!!state} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{state?.ing.name} — price history</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">No price changes recorded yet.</p>
          )}
          {filtered.map((h) => (
            <div
              key={h.id}
              className="rounded-lg border border-border bg-surface-elevated p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium tabular-nums">
                  {sym(h.currency)}
                  {Number(h.old_price).toFixed(h.currency === "usd" ? 4 : 2)} → {sym(h.currency)}
                  {Number(h.new_price).toFixed(h.currency === "usd" ? 4 : 2)}
                </span>
                <span className="text-xs uppercase text-muted-foreground">{h.currency}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(h.changed_at).toLocaleString()} · {h.changed_by_name ?? "Unknown"}
              </div>
              {h.reason && <div className="mt-1 text-xs">Reason: {h.reason}</div>}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

type IngBulkRow = {
  name: string;
  category: string;
  unit: string;
  price_inr?: number;
  price_usd?: number;
};
function IngredientBulk({
  units,
  country,
  onDone,
}: {
  units: Unit[];
  country: ReturnType<typeof useFoodcostCountry>;
  onDone: () => void;
}) {
  const unitByCode = new Map(units.map((u) => [u.code.toLowerCase(), u]));
  const validCats = INGREDIENT_CATEGORIES.map((c) => c.value);
  const cols: BulkColumn<IngBulkRow>[] = [
    { key: "name", label: "Name", required: true, example: "Tomato" },
    {
      key: "category",
      label: `Category (${validCats.join("|")})`,
      required: true,
      example: "vegetable",
      validate: (v) =>
        validCats.includes(String(v) as FcIngredientCategory) ? null : "unknown category",
    },
    {
      key: "unit",
      label: "Unit code",
      required: true,
      example: units[0]?.code ?? "kg",
      validate: (v) => (unitByCode.has(String(v).toLowerCase()) ? null : "unknown unit code"),
    },
    ...(country !== "us"
      ? [
          {
            key: "price_inr" as const,
            label: "Price INR",
            example: 50,
            validate: (v: unknown) => (isNaN(Number(v)) ? "must be a number" : null),
          },
        ]
      : []),
    ...(country !== "in"
      ? [
          {
            key: "price_usd" as const,
            label: "Price USD",
            example: 0.6,
            validate: (v: unknown) => (isNaN(Number(v)) ? "must be a number" : null),
          },
        ]
      : []),
  ];
  return (
    <BulkUpload
      entity="ingredients"
      columns={cols}
      hint="Unit codes must match existing units (e.g. kg, g, l, ml, pcs)."
      onCommit={async (rows) => {
        const payload = rows.map((r) => ({
          name: r.name,
          category: r.category as FcIngredientCategory,
          base_unit_id: unitByCode.get(String(r.unit).toLowerCase())!.id,
          price_inr: Number(r.price_inr ?? 0),
          price_usd: Number(r.price_usd ?? 0),
          status: "active" as FcStatus,
          active_in: country !== "us",
          active_us: country === "us",
        }));
        const { error } = await api.post("/foodcost/ingredients", payload).then((r) => r.data);
        if (error) throw new Error(error.message);
        return { inserted: payload.length };
      }}
      onDone={onDone}
    />
  );
}

function downloadChecklistPdf(
  rows: Ingredient[],
  units: Unit[],
  country: ReturnType<typeof useFoodcostCountry>,
) {
  const isUS = country === "us";
  const currencyLabel = isUS ? "USD / unit" : "INR / unit";
  const sym = isUS ? "$" : "Rs ";

  const title = `Ingredients Checklist — ${isUS ? "US" : "India"}`;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleDateString()}  ·  ${rows.length} items`, 40, 56);
  doc.setTextColor(0);

  // Group by category
  const grouped = new Map<string, Ingredient[]>();
  for (const r of rows) {
    const k = r.category;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(r);
  }
  const orderedCats = INGREDIENT_CATEGORIES.filter((c) => grouped.has(c.value));

  let cursorY = 75;
  for (const cat of orderedCats) {
    const items = grouped.get(cat.value)!.sort((a, b) => a.name.localeCompare(b.name));
    const body = items.map((r) => {
      const unitCode = units.find((u) => u.id === r.base_unit_id)?.code ?? "";
      const unitDisp = unitCode === "l" ? "L" : unitCode.toUpperCase();
      const price = isUS ? Number(r.price_usd).toFixed(2) : Number(r.price_inr).toFixed(2);
      return [r.name, unitDisp, `${sym}${price}`, ""];
    });
    autoTable(doc, {
      startY: cursorY,
      head: [
        [
          {
            content: cat.label,
            colSpan: 4,
            styles: { fillColor: [40, 40, 40], textColor: 255, halign: "left" },
          },
        ],
        ["Ingredient", "Unit", `System ${currencyLabel}`, "Physical check"],
      ],
      body,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [230, 230, 230], textColor: 20 },
      columnStyles: {
        0: { cellWidth: pageW * 0.42 },
        1: { cellWidth: pageW * 0.1, halign: "center" },
        2: { cellWidth: pageW * 0.18, halign: "right" },
        3: { cellWidth: pageW * 0.22 },
      },
      margin: { left: 40, right: 40 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  doc.save(
    `ingredients-checklist-${isUS ? "us" : "in"}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

const SPEC_BUCKETS: { value: string; label: string }[] = [
  { value: "grocery", label: "Grocery" },
  { value: "vegetable", label: "Veg" },
  { value: "spice", label: "Spice" },
  { value: "oil", label: "Oil" },
  { value: "dairy", label: "Dairy" },
];

function groupForSpec(rows: Ingredient[]) {
  const grouped = new Map<string, Ingredient[]>();
  for (const r of rows) {
    if (!SPEC_BUCKETS.find((b) => b.value === r.category)) continue;
    if (!grouped.has(r.category)) grouped.set(r.category, []);
    grouped.get(r.category)!.push(r);
  }
  for (const list of grouped.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return grouped;
}

function unitDisplay(r: Ingredient, units: Unit[]) {
  const code = units.find((u) => u.id === r.base_unit_id)?.code ?? "";
  return code === "l" ? "L" : code.toUpperCase();
}

function downloadSpecExcel(
  rows: Ingredient[],
  units: Unit[],
  country: ReturnType<typeof useFoodcostCountry>,
) {
  const isUS = country === "us";
  const grouped = groupForSpec(rows);
  const wb = XLSX.utils.book_new();

  // Summary "All" sheet
  const allRows: (string | number)[][] = [["Category", "Name", "Unit", "Brand / Spec"]];
  for (const b of SPEC_BUCKETS) {
    const items = grouped.get(b.value) ?? [];
    for (const r of items) allRows.push([b.label, r.name, unitDisplay(r, units), ""]);
  }
  const allWs = XLSX.utils.aoa_to_sheet(allRows);
  allWs["!cols"] = [{ wch: 14 }, { wch: 32 }, { wch: 10 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, allWs, "All");

  for (const b of SPEC_BUCKETS) {
    const items = grouped.get(b.value) ?? [];
    const data: (string | number)[][] = [["Name", "Category", "Unit", "Brand / Spec"]];
    for (const r of items) data.push([r.name, b.label, unitDisplay(r, units), ""]);
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, b.label);
  }
  XLSX.writeFile(
    wb,
    `ingredient-spec-${isUS ? "us" : "in"}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

function downloadSpecPdf(
  rows: Ingredient[],
  units: Unit[],
  country: ReturnType<typeof useFoodcostCountry>,
) {
  const isUS = country === "us";
  const grouped = groupForSpec(rows);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const title = `Ingredient Spec Sheet — ${isUS ? "US" : "India"}`;
  doc.setFontSize(15);
  doc.text(title, 40, 42);
  doc.setFontSize(9);
  doc.setTextColor(120);
  const total = SPEC_BUCKETS.reduce((sum, b) => sum + (grouped.get(b.value)?.length ?? 0), 0);
  doc.text(
    `Generated ${new Date().toLocaleDateString()}  ·  ${total} items  ·  Brand / Spec column for kitchen fill-in`,
    40,
    58,
  );
  doc.setTextColor(0);

  let cursorY = 78;
  for (const b of SPEC_BUCKETS) {
    const items = grouped.get(b.value) ?? [];
    if (items.length === 0) continue;
    const body = items.map((r) => [r.name, b.label, unitDisplay(r, units), ""]);
    autoTable(doc, {
      startY: cursorY,
      head: [
        [
          {
            content: `${b.label}  (${items.length})`,
            colSpan: 4,
            styles: {
              fillColor: [15, 118, 110],
              textColor: 255,
              halign: "left",
              fontStyle: "bold",
            },
          },
        ],
        ["Name", "Category", "Unit", "Brand / Spec"],
      ],
      body,
      styles: { fontSize: 9, cellPadding: 5, lineColor: [220, 220, 220], lineWidth: 0.4 },
      headStyles: { fillColor: [240, 253, 250], textColor: 20, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: pageW * 0.34 },
        1: { cellWidth: pageW * 0.12 },
        2: { cellWidth: pageW * 0.1, halign: "center" },
        3: { cellWidth: pageW * 0.36 },
      },
      margin: { left: 40, right: 40 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  doc.save(`ingredient-spec-${isUS ? "us" : "in"}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
