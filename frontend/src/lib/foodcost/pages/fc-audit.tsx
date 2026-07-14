import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Printer, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  toBase,
  fmt,
  type Brand,
  type Category,
  type Product,
  type Ingredient,
  type Unit,
} from "@/lib/foodcost/types";
import { DataIntegrityPanel } from "@/lib/foodcost/components/data-integrity-panel";

type Country = "in" | "us";
type Currency = "inr" | "usd";

type Prep = { id: string; name: string; code: string; base_unit_id: string };
type PrepCost = { prep_id: string; unit_cost_inr: number | null; unit_cost_usd: number | null };
type Recipe = {
  id: string;
  category_id: string | null;
  product_id: string | null;
  current_version_id: string | null;
};
type Version = {
  id: string;
  recipe_id: string;
  version_no: number;
  yield_qty: number | null;
  yield_unit_id: string | null;
  wastage_pct: number | null;
};
type RecipeItem = {
  id: string;
  version_id: string;
  position: number;
  ingredient_id: string | null;
  prep_id: string | null;
  is_veg_slot: boolean;
  qty: number;
  unit_id: string;
  notes: string | null;
};
type PackingContainer = { id: string; name: string; price_inr: number; price_usd: number };

type Flag = { level: "error" | "warn"; msg: string };

type LineRow = {
  pos: number;
  kind: "ingredient" | "prep" | "veg-slot";
  name: string;
  qty: number;
  unitCode: string;
  unitPrice: number;
  lineCost: number;
  flags: Flag[];
};

type ProductAudit = {
  product: Product;
  category: Category | null;
  brand: Brand | null;
  lines: LineRow[];
  productFlags: Flag[];
  subTotalLines: number;
  fc: number;
  packingPrice: number;
  ppp: number;
  sheroMargin: number;
  mrp: number;
};

function computePricing(fc: number) {
  const ptr = fc * 2;
  const ppp = fc + ptr;
  const shero = fc * 1.6;
  return { ptr, ppp, shero, mrp: ppp + shero };
}

export function FcAuditPage({ country }: { country: Country }) {
  const ccy: Currency = country === "in" ? "inr" : "usd";

  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [levelFilter, setLevelFilter] = useState<"all" | "error" | "warn">("all");
  const [errorFilter, setErrorFilter] = useState<string>("all");

  const { data: bundle, isLoading: loading } = useQuery({
    queryKey: ["fc-audit-bundle", country, ccy],
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const [bRes, cRes, pRes, iRes, uRes, prRes, pcRes, rRes, vRes, itRes, contRes] =
        await Promise.all([
          api.get("/foodcost/brands", { params: { country: country ?? undefined } }),
          api.get("/foodcost/categories", { params: { country: country ?? undefined } }),
          api.get("/foodcost/products", { params: { country: country ?? undefined } }),
          api.get("/foodcost/ingredients", { params: { country: country ?? undefined } }),
          api.get("/foodcost/units", { params: { country: country ?? undefined } }),
          api.get("/foodcost/preps", { params: { country: country ?? undefined } }),
          api.get("/foodcost/preps"),
          api.get("/foodcost/recipes", { params: { country: country ?? undefined } }),
          api.get("/foodcost/recipe-versions", { params: { country: country ?? undefined } }),
          (async () => {
            const allItems = await api
              .get("/foodcost/recipe-items")
              .then((r) => r.data as RecipeItem[])
              .catch(() => []);
            return allItems;
          })(),
          api.get("/foodcost/packing-containers", { params: { country: country ?? undefined } }),
        ]);

      const prods = (pRes.data ?? []) as Product[];
      const pcMap: Record<string, PrepCost> = {};
      for (const r of (pcRes.data ?? []) as PrepCost[]) pcMap[r.prep_id] = r;
      const cm: Record<string, PackingContainer> = {};
      for (const c of (contRes.data ?? []) as PackingContainer[]) cm[c.id] = c;

      // Fetch the canonical product cost per product (matches DB logic incl. veg slot)
      const costs: Record<string, number> = {};
      await Promise.all(
        prods.map(async (p) => {
          const { data } = await api.post("/foodcost/rpc/fc-product-cost", {
            _product_id: p.id,
            _currency: ccy,
          });
          costs[p.id] = Number(data ?? 0);
        }),
      );

      return {
        brands: (bRes.data ?? []) as Brand[],
        categories: (cRes.data ?? []) as Category[],
        products: prods,
        ingredients: (iRes.data ?? []) as Ingredient[],
        units: (uRes.data ?? []) as Unit[],
        preps: (prRes.data ?? []) as Prep[],
        prepCosts: pcMap,
        recipes: (rRes.data ?? []) as Recipe[],
        versions: (vRes.data ?? []) as Version[],
        items: (itRes.data ?? []) as RecipeItem[],
        containers: cm,
        productCosts: costs,
      };
    },
  });

  const brands = useMemo(() => (bundle?.brands ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [bundle?.brands]);
  const categories = useMemo(() => (bundle?.categories ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [bundle?.categories]);
  const products = useMemo(() => (bundle?.products ?? []).slice(), [bundle?.products]);
  const ingredients = useMemo(() => (bundle?.ingredients ?? []).slice(), [bundle?.ingredients]);
  const units = useMemo(() => (bundle?.units ?? []).slice(), [bundle?.units]);
  const preps = useMemo(() => (bundle?.preps ?? []).slice(), [bundle?.preps]);
  const prepCosts = useMemo(() => bundle?.prepCosts ?? {}, [bundle?.prepCosts]);
  const recipes = useMemo(() => (bundle?.recipes ?? []).slice(), [bundle?.recipes]);
  const versions = useMemo(() => (bundle?.versions ?? []).slice(), [bundle?.versions]);
  const items = useMemo(() => (bundle?.items ?? []).slice(), [bundle?.items]);
  const containers = useMemo(() => bundle?.containers ?? {}, [bundle?.containers]);
  const productCosts = useMemo(() => bundle?.productCosts ?? {}, [bundle?.productCosts]);

  const audits = useMemo<ProductAudit[]>(() => {
    if (loading) return [];
    const ingMap = new Map(ingredients.map((i) => [i.id, i] as const));
    const prepMap = new Map(preps.map((p) => [p.id, p] as const));
    const unitMap = new Map(units.map((u) => [u.id, u] as const));
    const catMap = new Map(categories.map((c) => [c.id, c] as const));
    const brandMap = new Map(brands.map((b) => [b.id, b] as const));
    const recipeById = new Map<string, Recipe>();
    const recipeByProduct = new Map<string, Recipe>();
    for (const r of recipes) {
      recipeById.set(r.id, r);
      if (r.product_id) recipeByProduct.set(r.product_id, r);
    }
    const versionsByRecipe = new Map<string, Version[]>();
    for (const v of versions) {
      const arr = versionsByRecipe.get(v.recipe_id) ?? [];
      arr.push(v);
      versionsByRecipe.set(v.recipe_id, arr);
    }
    const itemsByVersion = new Map<string, RecipeItem[]>();
    for (const it of items) {
      const arr = itemsByVersion.get(it.version_id) ?? [];
      arr.push(it);
      itemsByVersion.set(it.version_id, arr);
    }

    const out: ProductAudit[] = [];
    for (const p of products) {
      const cat = catMap.get(p.category_id) ?? null;
      const brand = brandMap.get(p.brand_id) ?? null;
      const productFlags: Flag[] = [];
      const lines: LineRow[] = [];

      if (!cat) productFlags.push({ level: "error", msg: "Product has no active category" });

      // Prefer the product's own recipe (non-CRC). Fall back to the category CRC.
      const ownRecipe = recipeByProduct.get(p.id) ?? null;
      const isNonCrc = !!ownRecipe;
      const recipe =
        ownRecipe ?? (cat?.crc_recipe_id ? (recipeById.get(cat.crc_recipe_id) ?? null) : null);
      const vList = recipe
        ? (versionsByRecipe.get(recipe.id) ?? []).sort(
            (a, b) =>
              (recipe.current_version_id === b.id ? 1 : 0) -
                (recipe.current_version_id === a.id ? 1 : 0) || b.version_no - a.version_no,
          )
        : [];
      const version = vList[0] ?? null;

      if (!recipe) {
        if (!isNonCrc) productFlags.push({ level: "error", msg: "Category has no CRC recipe" });
      } else if (!version) {
        productFlags.push({
          level: "error",
          msg: isNonCrc ? "Product recipe has no version" : "CRC recipe has no version",
        });
      } else if (recipe.current_version_id !== version.id) {
        productFlags.push({ level: "warn", msg: "Current version pointer not set — using latest" });
      }

      const rows = version ? (itemsByVersion.get(version.id) ?? []) : [];
      let hasVegSlot = false;
      let subTotal = 0;

      for (const it of rows) {
        const unit = unitMap.get(it.unit_id);
        const unitCode = unit?.code ?? "?";
        const flags: Flag[] = [];
        if (it.is_veg_slot) {
          hasVegSlot = true;
          if (!it.qty || it.qty <= 0) flags.push({ level: "error", msg: "Veg slot qty is 0" });
          lines.push({
            pos: it.position,
            kind: "veg-slot",
            name: "[Vegetable slot — selected per product]",
            qty: Number(it.qty ?? 0),
            unitCode,
            unitPrice: 0,
            lineCost: 0,
            flags,
          });
          continue;
        }

        if (!it.ingredient_id && !it.prep_id) {
          flags.push({ level: "error", msg: "Line has no ingredient or pre-prep reference" });
          lines.push({
            pos: it.position,
            kind: "ingredient",
            name: it.notes ?? "(unknown)",
            qty: Number(it.qty ?? 0),
            unitCode,
            unitPrice: 0,
            lineCost: 0,
            flags,
          });
          continue;
        }

        if (it.ingredient_id) {
          const ing = ingMap.get(it.ingredient_id);
          if (!ing) {
            flags.push({ level: "error", msg: "Referenced ingredient is missing/inactive" });
            lines.push({
              pos: it.position,
              kind: "ingredient",
              name: "(missing ingredient)",
              qty: Number(it.qty ?? 0),
              unitCode,
              unitPrice: 0,
              lineCost: 0,
              flags,
            });
            continue;
          }
          const baseCode = unitMap.get(ing.base_unit_id)?.code ?? "";
          const price = ccy === "inr" ? Number(ing.price_inr) : Number(ing.price_usd);
          const qtyInBase = baseCode
            ? toBase(Number(it.qty), unitCode) / Math.max(toBase(1, baseCode), 0.0000001)
            : 0;
          const lineCost = qtyInBase * price;
          subTotal += lineCost;
          if (!it.qty || it.qty <= 0) flags.push({ level: "error", msg: "Qty is 0" });
          if (!price || price <= 0)
            flags.push({ level: "error", msg: `Unit price is 0 (${ccy.toUpperCase()})` });
          const activeFlag = ccy === "inr" ? ing.active_in : ing.active_us;
          if (!activeFlag)
            flags.push({ level: "warn", msg: `Ingredient not active in ${country.toUpperCase()}` });
          lines.push({
            pos: it.position,
            kind: "ingredient",
            name: ing.name,
            qty: Number(it.qty),
            unitCode,
            unitPrice: price,
            lineCost,
            flags,
          });
        } else if (it.prep_id) {
          const prep = prepMap.get(it.prep_id);
          if (!prep) {
            flags.push({ level: "error", msg: "Referenced pre-prep is missing/inactive" });
            lines.push({
              pos: it.position,
              kind: "prep",
              name: "(missing pre-prep)",
              qty: Number(it.qty ?? 0),
              unitCode,
              unitPrice: 0,
              lineCost: 0,
              flags,
            });
            continue;
          }
          const pc = prepCosts[it.prep_id];
          const unitCost =
            ccy === "inr" ? Number(pc?.unit_cost_inr ?? 0) : Number(pc?.unit_cost_usd ?? 0);
          const baseCode = unitMap.get(prep.base_unit_id)?.code ?? "";
          // approximate line cost using unit price per base unit (kg/l/pcs)
          const qtyInBase = baseCode
            ? toBase(Number(it.qty), unitCode) / Math.max(toBase(1, baseCode), 0.0000001)
            : 0;
          const lineCost = qtyInBase * unitCost;
          subTotal += lineCost;
          if (!it.qty || it.qty <= 0) flags.push({ level: "error", msg: "Qty is 0" });
          if (!unitCost || unitCost <= 0)
            flags.push({ level: "error", msg: `Pre-prep unit cost is 0 (${ccy.toUpperCase()})` });
          lines.push({
            pos: it.position,
            kind: "prep",
            name: `${prep.name} · ${prep.code}`,
            qty: Number(it.qty),
            unitCode,
            unitPrice: unitCost,
            lineCost,
            flags,
          });
        }
      }

      if (version && rows.filter((r) => !r.is_veg_slot).length === 0) {
        productFlags.push({
          level: "error",
          msg: isNonCrc ? "Product recipe has no priced lines" : "CRC recipe has no priced lines",
        });
      }
      if (!isNonCrc && p.veg_mode && p.veg_mode !== "none" && !hasVegSlot) {
        productFlags.push({
          level: "warn",
          msg: `Product is veg-mode "${p.veg_mode}" but CRC has no vegetable slot`,
        });
      }
      if (
        (p.veg_mode === "single" || p.veg_mode === "multi") &&
        (!p.veg_ingredient_ids || p.veg_ingredient_ids.length === 0)
      ) {
        productFlags.push({
          level: "error",
          msg: `Veg mode "${p.veg_mode}" but no vegetables assigned`,
        });
      }
      if (cat && !cat.packing_container_id)
        productFlags.push({ level: "warn", msg: "Category has no packing container linked" });

      const fc = Number(productCosts[p.id] ?? 0);
      if (fc <= 0) productFlags.push({ level: "error", msg: "Final FC is 0" });

      const packing = cat?.packing_container_id ? containers[cat.packing_container_id] : undefined;
      const packingPrice = packing
        ? ccy === "inr"
          ? Number(packing.price_inr)
          : Number(packing.price_usd)
        : 0;
      const pricing = computePricing(fc);

      out.push({
        product: p,
        category: cat,
        brand,
        lines: lines.sort((a, b) => a.pos - b.pos),
        productFlags,
        subTotalLines: subTotal,
        fc,
        packingPrice,
        ppp: pricing.ppp,
        sheroMargin: pricing.shero,
        mrp: pricing.mrp,
      });
    }
    return out;
  }, [
    loading,
    products,
    categories,
    brands,
    recipes,
    versions,
    items,
    ingredients,
    preps,
    units,
    prepCosts,
    containers,
    productCosts,
    ccy,
    country,
  ]);

  const errorOptions = useMemo(() => {
    const counts = new Map<string, { msg: string; level: "error" | "warn"; count: number }>();
    for (const a of audits) {
      const all: Flag[] = [...a.productFlags, ...a.lines.flatMap((l) => l.flags)];
      for (const f of all) {
        if (levelFilter !== "all" && f.level !== levelFilter) continue;
        const key = `${f.level}::${f.msg}`;
        const cur = counts.get(key);
        if (cur) cur.count += 1;
        else counts.set(key, { msg: f.msg, level: f.level, count: 1 });
      }
    }
    return Array.from(counts.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count || a.msg.localeCompare(b.msg));
  }, [audits, levelFilter]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return audits.filter((a) => {
      if (brandFilter !== "all" && a.product.brand_id !== brandFilter) return false;
      if (categoryFilter !== "all" && a.product.category_id !== categoryFilter) return false;
      if (q && !`${a.product.name} ${a.product.code}`.toLowerCase().includes(q)) return false;
      const allFlags: Flag[] = [...a.productFlags, ...a.lines.flatMap((l) => l.flags)];
      if (levelFilter !== "all" && !allFlags.some((f) => f.level === levelFilter)) return false;
      if (errorFilter !== "all") {
        if (!allFlags.some((f) => `${f.level}::${f.msg}` === errorFilter)) return false;
      }
      if (onlyIssues && allFlags.length === 0) return false;
      return true;
    });
  }, [audits, brandFilter, categoryFilter, search, onlyIssues, levelFilter, errorFilter]);

  const grouped = useMemo(() => {
    const byBrand = new Map<string, ProductAudit[]>();
    for (const a of visible) {
      const key = a.brand?.id ?? "_none";
      const arr = byBrand.get(key) ?? [];
      arr.push(a);
      byBrand.set(key, arr);
    }
    return byBrand;
  }, [visible]);

  const totalIssues = visible.reduce(
    (acc, a) => acc + a.productFlags.length + a.lines.reduce((s, l) => s + l.flags.length, 0),
    0,
  );
  const productsWithIssues = visible.filter(
    (a) => a.productFlags.length || a.lines.some((l) => l.flags.length),
  ).length;

  return (
    <div className="crc-print space-y-4 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">FC Audit · {country.toUpperCase()}</h1>
          <p className="text-xs text-muted-foreground">
            Line-by-line Food Cost split for every active product. Flags zero qty, zero price,
            missing refs, and broken CRCs.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2 no-print">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Brand
            </label>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Category
            </label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories
                  .filter((c) => brandFilter === "all" || c.brand_id === brandFilter)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Search
            </label>
            <Input
              className="h-8 w-48"
              placeholder="Product name / code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Severity
            </label>
            <Select
              value={levelFilter}
              onValueChange={(v) => {
                setLevelFilter(v as "all" | "error" | "warn");
                setErrorFilter("all");
              }}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="error">Errors only</SelectItem>
                <SelectItem value="warn">Warnings only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Error / Warning
            </label>
            <Select value={errorFilter} onValueChange={setErrorFilter}>
              <SelectTrigger className="h-8 w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-w-md">
                <SelectItem value="all">All messages</SelectItem>
                {errorOptions.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    <span className="mr-2 inline-block w-12 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {o.level}
                    </span>
                    <span>{o.msg}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({o.count})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex h-8 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={onlyIssues}
              onChange={(e) => setOnlyIssues(e.target.checked)}
            />
            Only show with issues
          </label>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-3 w-3" />
            Print (A4)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Products" value={String(visible.length)} />
        <Stat
          label="With issues"
          value={String(productsWithIssues)}
          tone={productsWithIssues > 0 ? "warn" : "ok"}
        />
        <Stat
          label="Total flags"
          value={String(totalIssues)}
          tone={totalIssues > 0 ? "warn" : "ok"}
        />
        <Stat label="Currency" value={ccy.toUpperCase()} />
      </div>

      <DataIntegrityPanel country={country} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No products match the current filters.
        </div>
      ) : (
        Array.from(grouped.entries()).map(([brandId, list]) => {
          const brand = list[0].brand;
          return (
            <section key={brandId} className="space-y-3">
              <h2 className="font-display text-lg font-semibold border-b border-border pb-1">
                {brand?.name ?? "Unassigned"}{" "}
                <span className="text-xs text-muted-foreground">({list.length})</span>
              </h2>
              <div className="space-y-3">
                {list.map((a) => (
                  <ProductCard key={a.product.id} a={a} ccy={ccy} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "";
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ProductCard({ a, ccy }: { a: ProductAudit; ccy: Currency }) {
  const anyIssue = a.productFlags.length > 0 || a.lines.some((l) => l.flags.length > 0);
  return (
    <div
      className={`rounded-2xl border ${anyIssue ? "border-amber-500/60" : "border-border"} bg-surface-elevated overflow-hidden break-inside-avoid`}
    >
      <div className="flex flex-wrap items-baseline gap-2 border-b border-border px-4 py-2">
        <div className="font-display font-semibold">{a.product.name}</div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {a.product.code}
        </span>
        <span className="text-xs text-muted-foreground">· {a.category?.name ?? "—"}</span>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span>
            FC <b className="tabular-nums">{fmt(a.fc, ccy)}</b>
          </span>
          <span className="text-muted-foreground">PPP {fmt(a.ppp, ccy)}</span>
          <span className="text-muted-foreground">MRP {fmt(a.mrp, ccy)}</span>
          {anyIssue ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
        </div>
      </div>

      {a.productFlags.length > 0 && (
        <ul className="border-b border-border bg-amber-500/5 px-4 py-2 text-xs">
          {a.productFlags.map((f, i) => (
            <li key={i} className={f.level === "error" ? "text-red-600" : "text-amber-700"}>
              ● {f.msg}
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left w-8">#</th>
              <th className="px-3 py-1.5 text-left">Kind</th>
              <th className="px-3 py-1.5 text-left">Ingredient / Pre-Prep</th>
              <th className="px-3 py-1.5 text-right">Qty</th>
              <th className="px-3 py-1.5 text-left">Unit</th>
              <th className="px-3 py-1.5 text-right">Unit price</th>
              <th className="px-3 py-1.5 text-right">Line cost</th>
              <th className="px-3 py-1.5 text-left">Issues</th>
            </tr>
          </thead>
          <tbody>
            {a.lines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-3 text-center text-muted-foreground italic">
                  No CRC lines
                </td>
              </tr>
            )}
            {a.lines.map((l, i) => (
              <tr
                key={i}
                className={`border-t border-border/40 ${l.flags.length ? "bg-red-500/5" : ""}`}
              >
                <td className="px-3 py-1.5 text-muted-foreground">{l.pos}</td>
                <td className="px-3 py-1.5 text-[10px] uppercase">{l.kind}</td>
                <td className="px-3 py-1.5">{l.name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.qty}</td>
                <td className="px-3 py-1.5">{l.unitCode}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {l.kind === "veg-slot" ? "—" : fmt(l.unitPrice, ccy, 4)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {l.kind === "veg-slot" ? "+ veg" : fmt(l.lineCost, ccy, 4)}
                </td>
                <td className="px-3 py-1.5 text-[11px]">
                  {l.flags.length === 0 ? (
                    <span className="text-emerald-600">✓</span>
                  ) : (
                    <ul>
                      {l.flags.map((f, j) => (
                        <li
                          key={j}
                          className={f.level === "error" ? "text-red-600" : "text-amber-700"}
                        >
                          ● {f.msg}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30 text-xs">
            <tr>
              <td colSpan={6} className="px-3 py-1.5 text-right text-muted-foreground">
                CRC line sub-total
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmt(a.subTotalLines, ccy)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={6} className="px-3 py-1.5 text-right text-muted-foreground">
                + Veg slot (canonical FC)
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                {fmt(a.fc, ccy)}
              </td>
              <td />
            </tr>
            <tr className="border-t border-border">
              <td colSpan={6} className="px-3 py-1.5 text-right">
                Packing
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmt(a.packingPrice, ccy)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={6} className="px-3 py-1.5 text-right">
                PPP (FC × 3)
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmt(a.ppp, ccy)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={6} className="px-3 py-1.5 text-right">
                Shero margin (FC × 1.6)
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmt(a.sheroMargin, ccy)}</td>
              <td />
            </tr>
            <tr>
              <td colSpan={6} className="px-3 py-1.5 text-right font-semibold">
                MRP (FC × 4.6)
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-bold text-emerald-600">
                {fmt(a.mrp, ccy)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
