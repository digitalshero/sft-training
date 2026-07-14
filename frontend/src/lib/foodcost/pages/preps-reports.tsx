import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PREP_TYPES,
  fmt,
  type Prep,
  type Unit,
  type Ingredient,
  type FcPrepType,
} from "@/lib/foodcost/types";
import { useFoodcostCountry, countryField, countryCurrency } from "@/lib/foodcost/country";

export function PrepReportsPage() {
  const country = useFoodcostCountry() ?? "in";
  const ccy = countryCurrency(country);
  const [preps, setPreps] = useState<Prep[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [costs, setCosts] = useState<Record<string, { inr: number | null; usd: number | null }>>(
    {},
  );
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<string>("all");
  const [minCost, setMinCost] = useState<string>("");
  const [maxCost, setMaxCost] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [p, u, i, c] = await Promise.all([
        api.get("/foodcost/preps", { params: { country: country ?? undefined } }),
        api.get("/foodcost/units", { params: { country: country ?? undefined } }),
        api.get("/foodcost/ingredients", { params: { country: country ?? undefined } }),
        api.get("/foodcost/preps"),
      ]);
      setPreps((p.data ?? []) as Prep[]);
      setUnits((u.data ?? []) as Unit[]);
      setIngredients((i.data ?? []) as Ingredient[]);
      const map: Record<string, { inr: number | null; usd: number | null }> = {};
      for (const r of (c.data ?? []) as Array<{
        prep_id: string;
        unit_cost_inr: number | null;
        unit_cost_usd: number | null;
      }>) {
        map[r.prep_id] = { inr: r.unit_cost_inr, usd: r.unit_cost_usd };
      }
      setCosts(map);
    })();
  }, [country]);

  const rows = useMemo(() => {
    return preps
      .map((p) => {
        const c = costs[p.id];
        const unit = ccy === "inr" ? c?.inr : c?.usd;
        const baseUnit = units.find((u) => u.id === p.base_unit_id)?.code ?? "";
        return { p, unit: unit == null ? null : Number(unit), baseUnit };
      })
      .filter(({ p, unit }) => {
        if (typeF !== "all" && p.type !== typeF) return false;
        if (q && !`${p.name} ${p.code}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (minCost !== "" && (unit ?? 0) < Number(minCost)) return false;
        if (maxCost !== "" && (unit ?? 0) > Number(maxCost)) return false;
        return true;
      });
  }, [preps, costs, units, ccy, typeF, q, minCost, maxCost]);

  const seasonings = rows.filter((r) => r.p.type === "seasoning" || r.p.type === "masala_mix");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Pre-Prep Reports ({ccy.toUpperCase()})</h1>
        <p className="text-xs text-muted-foreground">
          {country === "in" ? "🇮🇳 India" : "🇺🇸 USA"} workspace — costs computed from{" "}
          {ccy.toUpperCase()} ingredient prices and approved versions only.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 w-56"
        />
        <Select value={typeF} onValueChange={setTypeF}>
          <SelectTrigger className="h-8 w-40">
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
        <Input
          placeholder="Min cost"
          value={minCost}
          onChange={(e) => setMinCost(e.target.value)}
          className="h-8 w-24"
        />
        <Input
          placeholder="Max cost"
          value={maxCost}
          onChange={(e) => setMaxCost(e.target.value)}
          className="h-8 w-24"
        />
      </div>

      <Tabs defaultValue="prep">
        <TabsList>
          <TabsTrigger value="prep">Pre-Prep Cost</TabsTrigger>
          <TabsTrigger value="seasoning">Seasoning Cost</TabsTrigger>
          <TabsTrigger value="product">Product Cost Impact</TabsTrigger>
          <TabsTrigger value="ingredient">Ingredient Price Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="prep">
          <CostTable rows={rows} ccy={ccy} />
        </TabsContent>

        <TabsContent value="seasoning">
          <CostTable rows={seasonings} ccy={ccy} />
        </TabsContent>

        <TabsContent value="product">
          <ProductImpact country={country} />
        </TabsContent>

        <TabsContent value="ingredient">
          <IngredientImpact ingredients={ingredients} ccy={ccy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CostTable({
  rows,
  ccy,
}: {
  rows: { p: Prep; unit: number | null; baseUnit: string }[];
  ccy: "inr" | "usd";
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Code</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-right">Cost / base unit</th>
            <th className="px-3 py-2 text-right">Cost / kg or l</th>
            <th className="px-3 py-2 text-right">Cost / 100 g or ml</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                No data.
              </td>
            </tr>
          )}
          {rows.map(({ p, unit, baseUnit }) => (
            <tr key={p.id} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
              <td className="px-3 py-2">{p.name}</td>
              <td className="px-3 py-2 text-xs">
                {PREP_TYPES.find((t) => t.value === p.type)?.label}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {unit == null ? "—" : `${fmt(unit, ccy, 4)} / ${baseUnit}`}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {unit == null ? "—" : fmt(unit, ccy)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {unit == null ? "—" : fmt(unit / 10, ccy, 4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductImpact({ country }: { country: "in" | "us" }) {
  const [rows, setRows] = useState<Array<{ product: string; preps: number }>>([]);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/foodcost/recipe-items");
        const counts: Record<string, number> = {};
        for (const it of (data ?? []) as Array<{
          prep_id?: string;
          product_name?: string;
          active_in?: boolean;
          active_us?: boolean;
        }>) {
          const prodName = it.product_name;
          if (!prodName) continue;
          if (country === "in" && it.active_in === false) continue;
          if (country === "us" && it.active_us === false) continue;
          counts[prodName] = (counts[prodName] ?? 0) + 1;
        }
        setRows(
          Object.entries(counts)
            .map(([product, preps]) => ({ product, preps }))
            .sort((a, b) => b.preps - a.preps),
        );
      } catch {
        setRows([]);
      }
    })();
  }, [country]);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-right"># Pre-Preps used</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">
                No products use pre-preps yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.product} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2">{r.product}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.preps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IngredientImpact({ ingredients, ccy }: { ingredients: Ingredient[]; ccy: "inr" | "usd" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Ingredient</th>
            <th className="px-3 py-2 text-right">Price ({ccy.toUpperCase()})</th>
            <th className="px-3 py-2 text-left">Last updated</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                No ingredients.
              </td>
            </tr>
          )}
          {ingredients.map((i) => (
            <tr key={i.id} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2">{i.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmt(ccy === "inr" ? Number(i.price_inr) : Number(i.price_usd), ccy, 4)}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {i.last_updated_at ? new Date(i.last_updated_at).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// satisfy unused FcPrepType import in TS strict
export type _Unused = FcPrepType;
