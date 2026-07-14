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
  createNutritionContext,
  hasMeaningfulNutrition,
  resolveProductIngredients,
  resolveProductNutrition,
} from "@/lib/foodcost/nutrition-resolver";
import {
  fmtRange,
  nutritionBadges,
  nutriRange,
  type Brand,
  type Category,
  type Ingredient,
  type NutriMacro,
  type NutritionResult,
  type PackingContainer,
  type Product,
  type Unit,
} from "@/lib/foodcost/types";

type Country = "in" | "us";

type Prep = { id: string; name: string; code: string };
type Recipe = {
  id: string;
  product_id: string | null;
  category_id: string | null;
  prep_id: string | null;
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
};

const MACRO_FIELDS = [
  "kcal_per_100",
  "protein_g_per_100",
  "carbs_g_per_100",
  "fat_g_per_100",
  "fibre_g_per_100",
] as const;
const MACRO_LABELS: Record<(typeof MACRO_FIELDS)[number], string> = {
  kcal_per_100: "kcal",
  protein_g_per_100: "P",
  carbs_g_per_100: "C",
  fat_g_per_100: "F",
  fibre_g_per_100: "Fb",
};

type IngFlag = { ing: Ingredient; missing: string[] };

type ProductNutri = {
  product: Product;
  category: Category | null;
  brand: Brand | null;
  container: PackingContainer | null;
  source: "product" | "category" | "none";
  hasRecipeGap: boolean;
  ingredients: { ing: Ingredient; via: string; missing: string[] }[];
  nutrition: NutritionResult | null;
  packagingText: string;
  servesText: string;
  badges: { label: string; tone: string }[];
  calorieText: string;
  descriptionNeedsReview: boolean;
  blockers: string[];
  warnings: string[];
  verdict: "Ready" | "Review" | "Blocked";
  issueCount: number;
};

export function NutriAuditPage({ country }: { country: Country }) {
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const { data: bundle, isLoading: loading } = useQuery({
    queryKey: ["nutri-audit-bundle", country],
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async () => {
      const activeKey = country === "in" ? "active_in" : "active_us";
      const [bRes, cRes, pRes, iRes, uRes, pcRes, prRes, rRes, vRes, itRes] = await Promise.all([
        api.get("/foodcost/brands", { params: { country: country ?? undefined } }).order("name"),
        api
          .get("/foodcost/categories", { params: { country: country ?? undefined } })
          .order("name"),
        api.get("/foodcost/products", { params: { country: country ?? undefined } }).order("code"),
        api.get("/foodcost/ingredients", { params: { country: country ?? undefined } }),
        api.get("/foodcost/units", { params: { country: country ?? undefined } }),
        api.get("/foodcost/packing-containers", { params: { country: country ?? undefined } }),
        api.get("/foodcost/preps", { params: { country: country ?? undefined } }),
        api.get("/foodcost/recipes", { params: { country: country ?? undefined } }),
        api.get("/foodcost/recipe-versions", { params: { country: country ?? undefined } }),
        (async () => {
          const allItems = await api
            .get("/foodcost/recipe-items")
            .then((r) => r.data as RecipeItem[])
            .catch(() => []);
          return allItems;
        })(),
      ]);
      return {
        brands: (bRes.data ?? []) as Brand[],
        categories: (cRes.data ?? []) as Category[],
        products: (pRes.data ?? []) as Product[],
        ingredients: (iRes.data ?? []) as Ingredient[],
        units: (uRes.data ?? []) as Unit[],
        containers: (pcRes.data ?? []) as PackingContainer[],
        preps: (prRes.data ?? []) as Prep[],
        recipes: (rRes.data ?? []) as Recipe[],
        versions: (vRes.data ?? []) as Version[],
        items: (itRes.data ?? []) as RecipeItem[],
      };
    },
  });

  const brands = bundle?.brands ?? [];
  const categories = bundle?.categories ?? [];
  const products = bundle?.products ?? [];
  const ingredients = bundle?.ingredients ?? [];
  const units = bundle?.units ?? [];
  const containers = bundle?.containers ?? [];
  const preps = bundle?.preps ?? [];
  const recipes = bundle?.recipes ?? [];
  const versions = bundle?.versions ?? [];
  const items = bundle?.items ?? [];

  const missingFor = (ing: Ingredient): string[] => {
    // Non-caloric / non-nutritional items (salt, packing, water, baking soda, utility "other" items) should never be flagged.
    const nameLc = String(ing.name).toLowerCase();
    const catLc = String(ing.category).toLowerCase();
    if (catLc === "packing") return [];
    if (catLc === "other") return [];
    if (/\bsalt\b/.test(nameLc)) return [];
    if (/baking soda|water/.test(nameLc)) return [];
    const kcal = Number((ing as unknown as Record<string, unknown>).kcal_per_100 ?? 0);
    // treat zero macros as legitimate (e.g. pure oils have 0 P/C/Fb).
    const p = Number((ing as unknown as Record<string, unknown>).protein_g_per_100 ?? 0);
    const c = Number((ing as unknown as Record<string, unknown>).carbs_g_per_100 ?? 0);
    const f = Number((ing as unknown as Record<string, unknown>).fat_g_per_100 ?? 0);
    const computed = p * 4 + c * 4 + f * 9;
    const reconciles = kcal > 0 && computed > 0 && Math.abs(computed - kcal) / kcal <= 0.15;
    if (reconciles) return [];
    const missing: string[] = [];
    for (const field of MACRO_FIELDS) {
      const v = Number((ing as unknown as Record<string, unknown>)[field] ?? 0);
      if (!v || v <= 0) missing.push(MACRO_LABELS[field]);
    }
    return missing;
  };

  const audits = useMemo<ProductNutri[]>(() => {
    if (loading) return [];
    const catMap = new Map(categories.map((c) => [c.id, c] as const));
    const brandMap = new Map(brands.map((b) => [b.id, b] as const));
    const containerMap = new Map(containers.map((c) => [c.id, c] as const));
    const unitCodeById = new Map(units.map((u) => [u.id, u.code] as const));
    const nutritionContext = createNutritionContext({
      ingredients,
      preps: preps as never[],
      recipes: recipes as never[],
      versions: versions as never[],
      items: items as never[],
      units,
    });

    const out: ProductNutri[] = [];
    for (const p of products) {
      const cat = catMap.get(p.category_id) ?? null;
      const brand = brandMap.get(p.brand_id) ?? null;
      const container = cat?.packing_container_id
        ? (containerMap.get(cat.packing_container_id) ?? null)
        : null;
      const resolved = resolveProductIngredients(nutritionContext, p, cat);
      const nutritionResolved = resolveProductNutrition(nutritionContext, p, cat);
      const nutrition = nutritionResolved.nutrition;
      const list = resolved.ingredients
        .filter(({ ing }) => String(ing.category).toLowerCase() !== "packing")
        .map(({ ing, via }) => ({ ing, via, missing: missingFor(ing) }))
        .sort(
          (a, b) => b.missing.length - a.missing.length || a.ing.name.localeCompare(b.ing.name),
        );
      const nutritionIssueCount =
        list.reduce((s, l) => s + (l.missing.length > 0 ? 1 : 0), 0) +
        (resolved.hasRecipeGap ? 1 : 0);
      const productMacros = getProductMacroRows(p, nutrition);
      const badgeInput = summarizeMacroRows(productMacros);
      const badges = badgeInput
        ? nutritionBadges(badgeInput, nutrition?.is_vegan ?? true, p.name)
        : [];
      const kcalRange = productMacros.length
        ? nutriRange(productMacros, "kcal")
        : { min: 0, max: 0 };
      const calorieText = productMacros.length
        ? fmtRange(kcalRange.min, kcalRange.max, " kcal", 0)
        : "—";
      const packagingText = formatPackaging(container, unitCodeById);
      const servesText = formatServes(p, cat);
      const descriptionText = String(p.menu_description ?? "").trim();
      const selectedVegNames = (p.veg_ingredient_ids ?? [])
        .map((id) => nutritionContext.ingredientById.get(id)?.name)
        .filter((name): name is string => Boolean(name));
      const descriptionNeedsReview =
        Boolean(descriptionText) &&
        selectedVegNames.length > 0 &&
        !mentionsAny(descriptionText, selectedVegNames);
      const blockers: string[] = [];
      const warnings: string[] = [];
      if (!packagingText) blockers.push("Packaging missing");
      if (!servesText) blockers.push("Serve size missing");
      if (!descriptionText) blockers.push("Description missing");
      if (!nutrition || !hasMeaningfulNutrition(nutrition) || nutritionIssueCount > 0)
        blockers.push("Nutrition incomplete");
      if (descriptionNeedsReview) warnings.push("Description does not mention selected vegetable");
      const verdict: ProductNutri["verdict"] = blockers.length
        ? "Blocked"
        : warnings.length
          ? "Review"
          : "Ready";
      out.push({
        product: p,
        category: cat,
        brand,
        container,
        source: resolved.source,
        hasRecipeGap: resolved.hasRecipeGap,
        ingredients: list,
        nutrition,
        packagingText,
        servesText,
        badges,
        calorieText,
        descriptionNeedsReview,
        blockers,
        warnings,
        verdict,
        issueCount: blockers.length + warnings.length,
      });
    }
    return out;
  }, [
    loading,
    products,
    categories,
    brands,
    containers,
    recipes,
    versions,
    items,
    ingredients,
    preps,
    units,
  ]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return audits.filter((a) => {
      if (brandFilter !== "all" && a.product.brand_id !== brandFilter) return false;
      if (categoryFilter !== "all" && a.product.category_id !== categoryFilter) return false;
      if (q && !`${a.product.name} ${a.product.code}`.toLowerCase().includes(q)) return false;
      if (onlyIssues && a.issueCount === 0) return false;
      return true;
    });
  }, [audits, brandFilter, categoryFilter, search, onlyIssues]);

  // Aggregate: which ingredients used in visible products are missing data
  const ingFlags: IngFlag[] = useMemo(() => {
    const map = new Map<string, IngFlag>();
    for (const a of visible) {
      for (const r of a.ingredients) {
        if (r.missing.length && !map.has(r.ing.id))
          map.set(r.ing.id, { ing: r.ing, missing: r.missing });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ing.name.localeCompare(b.ing.name));
  }, [visible]);

  const grouped = useMemo(() => {
    const byBrand = new Map<string, ProductNutri[]>();
    for (const a of visible) {
      const key = a.brand?.id ?? "_none";
      const arr = byBrand.get(key) ?? [];
      arr.push(a);
      byBrand.set(key, arr);
    }
    return byBrand;
  }, [visible]);

  const productsWithIssues = visible.filter((a) => a.issueCount > 0).length;
  const summary = useMemo(() => {
    const brandSummary = new Map<
      string,
      { brand: string; total: number; ready: number; review: number; blocked: number }
    >();
    let ready = 0;
    let review = 0;
    let blocked = 0;
    let missingPackaging = 0;
    let missingServes = 0;
    let missingDescription = 0;
    let nutritionBlocked = 0;
    let descriptionWarnings = 0;
    for (const a of audits) {
      const brandName = a.brand?.name ?? "Unassigned";
      const row = brandSummary.get(brandName) ?? {
        brand: brandName,
        total: 0,
        ready: 0,
        review: 0,
        blocked: 0,
      };
      row.total += 1;
      if (a.verdict === "Ready") {
        ready += 1;
        row.ready += 1;
      }
      if (a.verdict === "Review") {
        review += 1;
        row.review += 1;
      }
      if (a.verdict === "Blocked") {
        blocked += 1;
        row.blocked += 1;
      }
      if (!a.packagingText) missingPackaging += 1;
      if (!a.servesText) missingServes += 1;
      if (!String(a.product.menu_description ?? "").trim()) missingDescription += 1;
      if (a.blockers.includes("Nutrition incomplete")) nutritionBlocked += 1;
      if (a.descriptionNeedsReview) descriptionWarnings += 1;
      brandSummary.set(brandName, row);
    }
    return {
      total: audits.length,
      ready,
      review,
      blocked,
      missingPackaging,
      missingServes,
      missingDescription,
      nutritionBlocked,
      descriptionWarnings,
      byBrand: Array.from(brandSummary.values()).sort((a, b) => a.brand.localeCompare(b.brand)),
    };
  }, [audits]);

  return (
    <div className="crc-print space-y-4 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Menu Readiness Audit · {country.toUpperCase()}
          </h1>
          <p className="text-xs text-muted-foreground">
            Product-by-product check of packaging, serves, description, calorie values, nested
            pre-preps, vegetables and badge inputs.
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
        <Stat label="Products audited" value={String(summary.total)} />
        <Stat
          label="Ready"
          value={String(summary.ready)}
          tone={summary.ready === summary.total ? "ok" : undefined}
        />
        <Stat
          label="Needs review"
          value={String(summary.review)}
          tone={summary.review > 0 ? "warn" : "ok"}
        />
        <Stat
          label="Blocked"
          value={String(summary.blocked)}
          tone={summary.blocked > 0 ? "warn" : "ok"}
        />
      </div>

      <section
        className={`rounded-2xl border p-4 ${summary.blocked > 0 ? "border-warning/40 bg-warning/5" : "border-success/40 bg-success/5"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Audit certificate</h2>
            <p className="text-xs text-muted-foreground">
              Status:{" "}
              {summary.blocked > 0
                ? "certificate withheld — live menu data still has blockers"
                : summary.review > 0
                  ? "conditional review"
                  : "all audited products are ready"}
              .
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold ${summary.blocked > 0 ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}
          >
            {summary.blocked > 0 ? "Not certifiable yet" : "Ready to certify"}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat
            label="Packaging gaps"
            value={String(summary.missingPackaging)}
            tone={summary.missingPackaging > 0 ? "warn" : "ok"}
          />
          <Stat
            label="Serve-size gaps"
            value={String(summary.missingServes)}
            tone={summary.missingServes > 0 ? "warn" : "ok"}
          />
          <Stat
            label="Description gaps"
            value={String(summary.missingDescription)}
            tone={summary.missingDescription > 0 ? "warn" : "ok"}
          />
          <Stat
            label="Nutrition blockers"
            value={String(summary.nutritionBlocked)}
            tone={summary.nutritionBlocked > 0 ? "warn" : "ok"}
          />
          <Stat
            label="Description review"
            value={String(summary.descriptionWarnings)}
            tone={summary.descriptionWarnings > 0 ? "warn" : "ok"}
          />
        </div>
        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          <p>
            Root cause: earlier fixes corrected nutrition calculation logic, CRC fallback and yield
            dilution; the remaining blockers are live menu data gaps still present in
            product/category records.
          </p>
          <p>
            Action owner: calculations and badge logic are now enforced here automatically; missing
            serve sizes and any final wording corrections need the authoritative menu/data owner to
            supply approved values.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-sm font-semibold">Brand summary</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1 text-left pr-3">Brand</th>
                <th className="py-1 text-right pr-3">Audited</th>
                <th className="py-1 text-right pr-3">Ready</th>
                <th className="py-1 text-right pr-3">Review</th>
                <th className="py-1 text-right">Blocked</th>
              </tr>
            </thead>
            <tbody>
              {summary.byBrand.map((row) => (
                <tr key={row.brand} className="border-b border-border/40">
                  <td className="py-1 pr-3 font-medium">{row.brand}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{row.total}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{row.ready}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{row.review}</td>
                  <td className="py-1 text-right tabular-nums">{row.blocked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {ingFlags.length > 0 && (
            <section className="rounded-2xl border border-warning/40 bg-warning/5 p-4 space-y-2">
              <h2 className="font-display text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Ingredients with missing nutrition data ({ingFlags.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left py-1 pr-3">Ingredient</th>
                      <th className="text-left py-1 pr-3">Category</th>
                      <th className="text-right py-1 pr-3">kcal/100</th>
                      <th className="text-right py-1 pr-3">P</th>
                      <th className="text-right py-1 pr-3">C</th>
                      <th className="text-right py-1 pr-3">F</th>
                      <th className="text-right py-1 pr-3">Fb</th>
                      <th className="text-left py-1">Missing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingFlags.map(({ ing, missing }) => (
                      <tr key={ing.id} className="border-b border-border/40">
                        <td className="py-1 pr-3 font-medium">{ing.name}</td>
                        <td className="py-1 pr-3 text-muted-foreground">{ing.category}</td>
                        <td className={cellTone(ing.kcal_per_100)}>{num(ing.kcal_per_100)}</td>
                        <td className={cellTone(ing.protein_g_per_100)}>
                          {num(ing.protein_g_per_100)}
                        </td>
                        <td className={cellTone(ing.carbs_g_per_100)}>
                          {num(ing.carbs_g_per_100)}
                        </td>
                        <td className={cellTone(ing.fat_g_per_100)}>{num(ing.fat_g_per_100)}</td>
                        <td className={cellTone(ing.fibre_g_per_100)}>
                          {num(ing.fibre_g_per_100)}
                        </td>
                        <td className="py-1 text-destructive">{missing.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No products match the current filters.
            </div>
          ) : (
            Array.from(grouped.entries()).map(([brandId, list]) => {
              const brand = list[0].brand;
              return (
                <section key={brandId} className="space-y-3 break-inside-avoid">
                  <h2 className="font-display text-lg font-semibold border-b border-border pb-1">
                    {brand?.name ?? "Unassigned"}{" "}
                    <span className="text-xs text-muted-foreground">({list.length})</span>
                  </h2>
                  <div className="space-y-3">
                    {list.map((a) => (
                      <ProductCard key={a.product.id} a={a} />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

function ProductCard({ a }: { a: ProductNutri }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <div>
          <div className="font-display text-base font-semibold">
            {a.product.code} · {a.product.name}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {a.category?.name ?? "No category"} · veg: {a.product.veg_mode} · source:{" "}
            {a.source === "product"
              ? "Product CRC"
              : a.source === "category"
                ? "Category CRC"
                : "No CRC"}{" "}
            · calories: {a.calorieText}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${a.verdict === "Ready" ? "bg-success/15 text-success" : a.verdict === "Review" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}
          >
            {a.verdict}
          </span>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
        <span
          className={`rounded-full px-2 py-0.5 ${a.packagingText ? "bg-muted text-foreground" : "bg-destructive/15 text-destructive"}`}
        >
          Packaging: {a.packagingText || "Missing"}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 ${a.servesText ? "bg-muted text-foreground" : "bg-destructive/15 text-destructive"}`}
        >
          Serves: {a.servesText || "Missing"}
        </span>
        {a.badges.map((badge) => (
          <span key={badge.label} className={`rounded-full px-2 py-0.5 ${badge.tone}`}>
            {badge.label}
          </span>
        ))}
      </div>
      <div className="mb-3 space-y-2">
        <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-line">
          {String(a.product.menu_description ?? "").trim() || "Description missing."}
        </div>
        {(a.blockers.length > 0 || a.warnings.length > 0) && (
          <div className="space-y-1 text-xs">
            {a.blockers.map((item) => (
              <div key={item} className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3" /> {item}
              </div>
            ))}
            {a.warnings.map((item) => (
              <div key={item} className="flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3 w-3" /> {item}
              </div>
            ))}
          </div>
        )}
        {a.blockers.length === 0 && a.warnings.length === 0 && (
          <div className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" /> Product record passed this audit.
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left py-1 pr-3">Ingredient</th>
              <th className="text-left py-1 pr-3">Via</th>
              <th className="text-right py-1 pr-3">kcal/100</th>
              <th className="text-right py-1 pr-3">P</th>
              <th className="text-right py-1 pr-3">C</th>
              <th className="text-right py-1 pr-3">F</th>
              <th className="text-right py-1 pr-3">Fb</th>
              <th className="text-left py-1">Missing</th>
            </tr>
          </thead>
          <tbody>
            {a.hasRecipeGap && (
              <tr className="border-b border-border/40">
                <td colSpan={8} className="py-2 text-destructive">
                  No usable product/category CRC lines found for this product.
                </td>
              </tr>
            )}
            {a.ingredients.length === 0 && (
              <tr>
                <td colSpan={8} className="py-2 text-muted-foreground italic">
                  No ingredients found.
                </td>
              </tr>
            )}
            {a.ingredients.map(({ ing, via, missing }) => (
              <tr key={ing.id} className="border-b border-border/40">
                <td className="py-1 pr-3">{ing.name}</td>
                <td className="py-1 pr-3 text-muted-foreground">{via}</td>
                <td className={cellTone(ing.kcal_per_100)}>{num(ing.kcal_per_100)}</td>
                <td className={cellTone(ing.protein_g_per_100)}>{num(ing.protein_g_per_100)}</td>
                <td className={cellTone(ing.carbs_g_per_100)}>{num(ing.carbs_g_per_100)}</td>
                <td className={cellTone(ing.fat_g_per_100)}>{num(ing.fat_g_per_100)}</td>
                <td className={cellTone(ing.fibre_g_per_100)}>{num(ing.fibre_g_per_100)}</td>
                <td className="py-1 text-destructive">{missing.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const cls =
    tone === "warn" ? "text-destructive" : tone === "ok" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function num(v: number | null | undefined) {
  const n = Number(v ?? 0);
  return n === 0 ? "0" : n.toFixed(n < 10 ? 2 : 1);
}
function cellTone(v: number | null | undefined) {
  const n = Number(v ?? 0);
  return `py-1 pr-3 text-right tabular-nums ${!n || n <= 0 ? "text-destructive font-semibold" : ""}`;
}

function formatPackaging(container: PackingContainer | null, unitCodeById: Map<string, string>) {
  if (!container) return "";
  const unit = container.size_unit_id ? (unitCodeById.get(container.size_unit_id) ?? "") : "";
  return `${container.size_qty}${unit ? ` ${unit}` : ""} ${container.name}`.trim();
}

function formatServes(product: Product, category: Category | null) {
  const direct = String(product.serves_label ?? "").trim();
  if (direct) return direct;
  const min = Number(category?.serves_min ?? 0);
  const max = Number(category?.serves_max ?? 0);
  if (min > 0 && max > min) return `Serves ${min}–${max}`;
  if (min > 0) return `Serves ${min}`;
  return "";
}

function getProductMacroRows(product: Product, nutrition: NutritionResult | null): NutriMacro[] {
  const base = nutrition?.base_per_100;
  const withVeg = nutrition?.with_veg ?? [];
  if (!base) return [];
  if (!withVeg.length || product.veg_mode === "none") return [base];
  const selectedVegIds = product.veg_ingredient_ids ?? [];
  if (selectedVegIds.length) {
    const matched = withVeg.filter((veg) => selectedVegIds.includes(veg.id));
    if (matched.length) return matched;
  }
  return [base, ...withVeg];
}

function summarizeMacroRows(rows: NutriMacro[]) {
  if (!rows.length) return null;
  const mid = (key: keyof NutriMacro) => {
    const range = nutriRange(rows, key);
    return (range.min + range.max) / 2;
  };
  return {
    kcal: mid("kcal"),
    protein: mid("protein"),
    carbs: mid("carbs"),
    fat: mid("fat"),
    fibre: mid("fibre"),
  } satisfies NutriMacro;
}

function mentionsAny(text: string, candidates: string[]) {
  const hay = text.toLowerCase();
  return candidates.some((candidate) => {
    const raw = candidate.toLowerCase();
    if (hay.includes(raw)) return true;
    return raw
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3)
      .some((token) => hay.includes(token));
  });
}
