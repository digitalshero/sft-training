import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Printer, FileSpreadsheet, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";
import { useFoodcostCountry, COUNTRY_LABEL, countryField } from "@/lib/foodcost/country";
import type { Product, Category, Brand, Ingredient } from "@/lib/foodcost/types";
import { exportXLSX, type ExportColumn } from "@/lib/export";

type RecipeRow = { id: string; current_version_id: string | null; product_id: string | null };
type ItemRow = { version_id: string; ingredient_id: string | null; is_veg_slot: boolean };

type Link = {
  vegId: string;
  productId: string;
  source: "product-recipe" | "crc-recipe" | "product-slot";
};

// Normalize veg names so duplicates (e.g. "Coriander" vs "Fresh Coriander Leaves",
// "Shallots" vs "Frozen Shallots") aggregate as the same vegetable.
const NAME_ALIASES: Record<string, string> = {
  "fresh coriander leaves": "coriander",
  "fresh mint leaf": "mint",
  "fresh mint leaves": "mint",
  "frozen shallots": "shallots",
  "frozen grated coconut": "coconut",
  "frozen sliced coconut": "coconut",
  "colocasia / seppankizhangu": "colocasia",
  "spinach / palak": "spinach",
  "tapioca / maravalli kizhangu": "tapioca",
  "chow chow / chayote": "chow chow",
  "yam / senai": "yam",
  "green chillies": "green chilli",
  "green chilly": "green chilli",
};
function normName(n: string): string {
  const k = n.toLowerCase().trim();
  return NAME_ALIASES[k] ?? k;
}

export function VegUsagePage() {
  const country = useFoodcostCountry();
  const [vegs, setVegs] = useState<Ingredient[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState("all");
  const [catId, setCatId] = useState("all");
  const [vegId, setVegId] = useState("all");
  const [source, setSource] = useState<"all" | "featured" | "recipe">("all");
  const [usageF, setUsageF] = useState<"all" | "used" | "unused">("used");

  async function load() {
    if (!country) return;
    const f = countryField(country);
    const [ing, c, b, p] = await Promise.all([
      api.get("/foodcost/ingredients", { params: { country: country ?? undefined } }).order("name"),
      api.get("/foodcost/categories", { params: { country: country ?? undefined } }).order("name"),
      api.get("/foodcost/brands", { params: { country: country ?? undefined } }).order("name"),
      api.get("/foodcost/products", { params: { country: country ?? undefined } }).order("name"),
    ]);
    if (ing.error) toast.error(ing.error.message);
    const vegList = (ing.data ?? []) as Ingredient[];
    const catList = (c.data ?? []) as Category[];
    const prodList = (p.data ?? []) as Product[];
    setVegs(vegList);
    setCats(catList);
    setBrands((b.data ?? []) as Brand[]);
    setProducts(prodList);

    // Fetch BOTH product-specific recipes AND category CRC recipes
    const productIds = prodList.map((p) => p.id);
    const crcRecipeIds = Array.from(
      new Set(catList.map((c) => c.crc_recipe_id).filter(Boolean) as string[]),
    );

    const [prodRecipesRes, crcRecipesRes] = await Promise.all([
      productIds.length
        ? api
            .get("/foodcost/recipes", { params: { country: country ?? undefined } })
            .in("product_id", productIds)
        : Promise.resolve({ data: [] as RecipeRow[] }),
      crcRecipeIds.length
        ? api
            .get("/foodcost/recipes", { params: { country: country ?? undefined } })
            .in("id", crcRecipeIds)
        : Promise.resolve({ data: [] as RecipeRow[] }),
    ]);
    const prodRecipes = (prodRecipesRes.data ?? []) as RecipeRow[];
    const crcRecipes = (crcRecipesRes.data ?? []) as RecipeRow[];

    const allVersionIds = Array.from(
      new Set(
        [...prodRecipes, ...crcRecipes]
          .map((r) => r.current_version_id)
          .filter(Boolean) as string[],
      ),
    );
    const items: ItemRow[] = [];
    if (allVersionIds.length) {
      // Chunk to stay under IN() limits
      const CHUNK = 200;
      for (let i = 0; i < allVersionIds.length; i += CHUNK) {
        const slice = allVersionIds.slice(i, i + CHUNK);
        const it = await api
          .get("/foodcost/recipe-items", { params: { country: country ?? undefined } })
          .in("version_id", slice);
        if (it.data) items.push(...(it.data as ItemRow[]));
      }
    }
    const vegSet = new Set(vegList.map((v) => v.id));

    // version_id -> { productIds?: string[], catId?: string }
    const versionTargets = new Map<string, { products: string[]; cats: string[] }>();
    for (const r of prodRecipes) {
      if (!r.current_version_id || !r.product_id) continue;
      const e = versionTargets.get(r.current_version_id) ?? { products: [], cats: [] };
      e.products.push(r.product_id);
      versionTargets.set(r.current_version_id, e);
    }
    const crcRecipeToCat = new Map<string, string>();
    for (const c of catList) if (c.crc_recipe_id) crcRecipeToCat.set(c.crc_recipe_id, c.id);
    for (const r of crcRecipes) {
      if (!r.current_version_id) continue;
      const cid = crcRecipeToCat.get(r.id);
      if (!cid) continue;
      const e = versionTargets.get(r.current_version_id) ?? { products: [], cats: [] };
      e.cats.push(cid);
      versionTargets.set(r.current_version_id, e);
    }
    const productsByCat = new Map<string, string[]>();
    for (const p of prodList) {
      const arr = productsByCat.get(p.category_id) ?? [];
      arr.push(p.id);
      productsByCat.set(p.category_id, arr);
    }

    const lnks: Link[] = [];
    const seen = new Set<string>();
    const push = (vegId: string, productId: string, src: Link["source"]) => {
      const k = `${vegId}|${productId}|${src}`;
      if (seen.has(k)) return;
      seen.add(k);
      lnks.push({ vegId, productId, source: src });
    };
    for (const it of items) {
      if (!it.ingredient_id || it.is_veg_slot) continue;
      if (!vegSet.has(it.ingredient_id)) continue;
      const tgt = versionTargets.get(it.version_id);
      if (!tgt) continue;
      for (const pid of tgt.products) push(it.ingredient_id, pid, "product-recipe");
      for (const cid of tgt.cats) {
        const ps = productsByCat.get(cid) ?? [];
        for (const pid of ps) push(it.ingredient_id, pid, "crc-recipe");
      }
    }
    for (const pr of prodList) {
      for (const v of pr.veg_ingredient_ids ?? []) {
        if (vegSet.has(v)) push(v, pr.id, "product-slot");
      }
    }
    setLinks(lnks);
  }
  useEffect(() => { load(); /* eslint-disable-line */ }, [country]);

  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);
  const catBrand = useMemo(() => new Map(cats.map((c) => [c.id, c.brand_id])), [cats]);
  const prodMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const vegName = useMemo(() => new Map(vegs.map((v) => [v.id, v.name])), [vegs]);
  // Map veg-id -> normalized key; key -> display label (prefer shortest original name)
  const vegKey = useMemo(() => new Map(vegs.map((v) => [v.id, normName(v.name)])), [vegs]);
  const keyLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vegs) {
      const k = normName(v.name);
      const cur = m.get(k);
      if (!cur || v.name.length < cur.length) m.set(k, v.name);
    }
    return m;
  }, [vegs]);
  // For the veg filter dropdown, dedupe by normalized key
  const vegOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; label: string }[] = [];
    for (const v of vegs) {
      const k = normName(v.name);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ key: k, label: keyLabel.get(k) ?? v.name });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [vegs, keyLabel]);

  const filteredLinks = useMemo(() => {
    const ql = q.toLowerCase();
    return links.filter((l) => {
      const p = prodMap.get(l.productId);
      if (!p) return false;
      if (source === "featured" && l.source !== "product-slot") return false;
      if (source === "recipe" && l.source === "product-slot") return false;
      const bId = catBrand.get(p.category_id);
      if (brandId !== "all" && bId !== brandId) return false;
      if (catId !== "all" && p.category_id !== catId) return false;
      if (vegId !== "all" && vegKey.get(l.vegId) !== vegId) return false;
      if (ql) {
        const hay =
          `${p.name} ${vegName.get(l.vegId) ?? ""} ${catName.get(p.category_id) ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [links, brandId, catId, vegId, q, source, prodMap, catBrand, vegName, vegKey, catName]);

  // By Vegetable pivot (keyed by normalized name)
  const byVeg = useMemo(() => {
    const map = new Map<
      string,
      { products: Set<string>; brands: Set<string>; cats: Set<string> }
    >();
    for (const l of filteredLinks) {
      const p = prodMap.get(l.productId)!;
      const bId = catBrand.get(p.category_id) ?? "";
      const k = vegKey.get(l.vegId) ?? l.vegId;
      if (!map.has(k)) map.set(k, { products: new Set(), brands: new Set(), cats: new Set() });
      const e = map.get(k)!;
      e.products.add(l.productId);
      if (bId) e.brands.add(bId);
      e.cats.add(p.category_id);
    }
    // Inject unused vegetables (zero links) when requested
    if (usageF === "all" || usageF === "unused") {
      for (const v of vegOptions) {
        if (!map.has(v.key))
          map.set(v.key, { products: new Set(), brands: new Set(), cats: new Set() });
      }
    }
    let entries = Array.from(map.entries());
    if (usageF === "used") entries = entries.filter(([, e]) => e.products.size > 0);
    if (usageF === "unused") entries = entries.filter(([, e]) => e.products.size === 0);
    return entries
      .map(([k, e]) => ({ key: k, label: keyLabel.get(k) ?? k, ...e }))
      .sort((a, b) => b.products.size - a.products.size || a.label.localeCompare(b.label));
  }, [filteredLinks, prodMap, catBrand, vegKey, keyLabel, usageF, vegOptions]);

  // By Product pivot (vegetable list deduped by normalized name)
  const byProduct = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of filteredLinks) {
      if (!map.has(l.productId)) map.set(l.productId, new Set());
      map.get(l.productId)!.add(vegKey.get(l.vegId) ?? l.vegId);
    }
    return Array.from(map.entries())
      .map(([pid, vs]) => ({ pid, vegs: Array.from(vs) }))
      .sort((a, b) =>
        (prodMap.get(a.pid)?.name ?? "").localeCompare(prodMap.get(b.pid)?.name ?? ""),
      );
  }, [filteredLinks, prodMap, vegKey]);

  function exportByVeg() {
    const rows = byVeg.map((r) => ({
      vegetable: r.label,
      products: r.products.size,
      brands: r.brands.size,
      categories: r.cats.size,
      brand_list: Array.from(r.brands)
        .map((b) => brandName.get(b) ?? "")
        .sort()
        .join(", "),
      product_list: Array.from(r.products)
        .map((p) => prodMap.get(p)?.name ?? "")
        .sort()
        .join(", "),
    }));
    if (!rows.length) {
      toast.error("Nothing to export");
      return;
    }
    const cols: ExportColumn<(typeof rows)[number]>[] = [
      { key: "vegetable", label: "Vegetable" },
      { key: "products", label: "# Products" },
      { key: "brands", label: "# Brands" },
      { key: "categories", label: "# Categories" },
      { key: "brand_list", label: "Brands" },
      { key: "product_list", label: "Products" },
    ];
    exportXLSX(
      `veg-usage-${country ?? "all"}-${new Date().toISOString().slice(0, 10)}`,
      rows,
      cols,
    );
    toast.success("Excel exported");
  }

  return (
    <div className="space-y-4 crc-print">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="mr-auto">
          <h2 className="font-display text-lg font-semibold">
            Veg Usage
            {country && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({COUNTRY_LABEL[country]})
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            Vegetables used across products — drawn from CRC recipes and product veg-slot
            selections.
          </p>
        </div>
        <Select
          value={brandId}
          onValueChange={(v) => {
            setBrandId(v);
            setCatId("all");
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All brands" />
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
        <Select value={catId} onValueChange={setCatId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats
              .filter((c) => brandId === "all" || c.brand_id === brandId)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => setSource(v as "featured" | "recipe" | "all")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">Featured veg (slot)</SelectItem>
            <SelectItem value="recipe">Recipe / aromatics</SelectItem>
            <SelectItem value="all">All sources</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vegId} onValueChange={setVegId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All vegetables" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vegetables</SelectItem>
            {vegOptions.map((v) => (
              <SelectItem key={v.key} value={v.key}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={usageF} onValueChange={(v) => setUsageF(v as "all" | "used" | "unused")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All usage</SelectItem>
            <SelectItem value="used">Used in products</SelectItem>
            <SelectItem value="unused">Unused vegetables</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="w-56"
        />
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1 h-3.5 w-3.5" />
          PDF
        </Button>
        <Button size="sm" variant="outline" onClick={exportByVeg}>
          <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
          Excel
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Vegetables in use"
          value={byVeg.filter((r) => r.products.size > 0).length}
        />
        <StatCard
          label={`Unused veg (of ${vegOptions.length})`}
          value={
            vegOptions.length -
            new Set(filteredLinks.map((l) => vegKey.get(l.vegId) ?? l.vegId)).size
          }
        />
        <StatCard
          label={`Products with veg (of ${products.length})`}
          value={new Set(filteredLinks.map((l) => l.productId)).size}
        />
        <StatCard
          label="Products without veg"
          value={products.length - new Set(filteredLinks.map((l) => l.productId)).size}
        />
      </div>

      <Tabs defaultValue="by-veg">
        <TabsList>
          <TabsTrigger value="by-veg">By Vegetable</TabsTrigger>
          <TabsTrigger value="by-product">By Product</TabsTrigger>
          <TabsTrigger value="fun-facts">
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Fun Facts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="by-veg" className="mt-3">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Vegetable</th>
                  <th className="px-3 py-2 text-right"># Products</th>
                  <th className="px-3 py-2 text-right"># Brands</th>
                  <th className="px-3 py-2 text-right"># Categories</th>
                  <th className="px-3 py-2 text-left">Brands</th>
                  <th className="px-3 py-2 text-left">Products</th>
                </tr>
              </thead>
              <tbody>
                {byVeg.map((r, i) => (
                  <tr
                    key={r.key}
                    className={`border-t border-border align-top ${i % 2 === 1 ? "bg-muted/30" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2 text-right">{r.products.size}</td>
                    <td className="px-3 py-2 text-right">{r.brands.size}</td>
                    <td className="px-3 py-2 text-right">{r.cats.size}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {Array.from(r.brands)
                        .map((b) => brandName.get(b))
                        .filter(Boolean)
                        .sort()
                        .join(", ")}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <ProductsCell
                        vegKey={r.key}
                        products={r.products}
                        prodMap={prodMap}
                        catBrand={catBrand}
                        brandName={brandName}
                      />
                    </td>
                  </tr>
                ))}
                {!byVeg.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No data for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="by-product" className="mt-3">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Brand</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right"># Vegetables</th>
                  <th className="px-3 py-2 text-left">Vegetables</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((r, i) => {
                  const p = prodMap.get(r.pid);
                  if (!p) return null;
                  const bId = catBrand.get(p.category_id) ?? "";
                  return (
                    <tr
                      key={r.pid}
                      className={`border-t border-border align-top ${i % 2 === 1 ? "bg-muted/30" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-xs">{brandName.get(bId)}</td>
                      <td className="px-3 py-2 text-xs">{catName.get(p.category_id)}</td>
                      <td className="px-3 py-2 text-right">{r.vegs.length}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.vegs
                          .map((k) => keyLabel.get(k) ?? k)
                          .sort()
                          .join(", ")}
                      </td>
                    </tr>
                  );
                })}
                {!byProduct.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No data for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="fun-facts" className="mt-3">
          <FunFactsPanel
            brandFilterId={brandId}
            brands={brands}
            byVeg={byVeg}
            byProduct={byProduct}
            filteredLinks={filteredLinks}
            prodMap={prodMap}
            catBrand={catBrand}
            catName={catName}
            brandName={brandName}
            keyLabel={keyLabel}
            productsTotal={products.length}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ProductsCell({
  vegKey,
  products,
  prodMap,
  catBrand,
  brandName,
}: {
  vegKey: string;
  products: Set<string>;
  prodMap: Map<string, Product>;
  catBrand: Map<string, string>;
  brandName: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const grouped = new Map<string, string[]>();
  for (const pid of products) {
    const p = prodMap.get(pid);
    if (!p) continue;
    const bn = brandName.get(catBrand.get(p.category_id) ?? "") ?? "—";
    const arr = grouped.get(bn) ?? [];
    arr.push(p.name);
    grouped.set(bn, arr);
  }
  const rows = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const COLLAPSED = 3;
  const showToggle = rows.length > COLLAPSED;
  const visible = open || !showToggle ? rows : rows.slice(0, COLLAPSED);
  return (
    <div>
      {visible.map(([bn, ps]) => (
        <div key={bn} className="mb-1">
          <span className="font-medium text-foreground">{bn}</span>
          {` (${ps.length}): ${ps.sort().join(", ")}`}
        </div>
      ))}
      {showToggle && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline print:hidden"
          aria-expanded={open}
          data-veg={vegKey}
        >
          {open
            ? "▲ Show less"
            : `▼ Show ${rows.length - COLLAPSED} more brand${rows.length - COLLAPSED === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

type ByVegRow = {
  key: string;
  label: string;
  products: Set<string>;
  brands: Set<string>;
  cats: Set<string>;
};
type ByProductRow = { pid: string; vegs: string[] };

function FunFactsPanel({
  brandFilterId,
  brands,
  byVeg,
  byProduct,
  filteredLinks,
  prodMap,
  catBrand,
  brandName,
  keyLabel,
  productsTotal,
}: {
  brandFilterId: string;
  brands: Brand[];
  byVeg: ByVegRow[];
  byProduct: ByProductRow[];
  filteredLinks: Link[];
  prodMap: Map<string, Product>;
  catBrand: Map<string, string>;
  catName: Map<string, string>;
  brandName: Map<string, string>;
  keyLabel: Map<string, string>;
  productsTotal: number;
}) {
  const facts = useMemo(() => {
    const productsWithVeg = new Set(filteredLinks.map((l) => l.productId));
    const brandsInScope =
      brandFilterId === "all"
        ? Array.from(
            new Set(
              filteredLinks
                .map((l) => catBrand.get(prodMap.get(l.productId)!.category_id) ?? "")
                .filter(Boolean),
            ),
          )
        : [brandFilterId];
    const brandLabel =
      brandFilterId === "all" ? "across all brands" : `at ${brandName.get(brandFilterId) ?? ""}`;

    const topVegs = byVeg.slice(0, 10);
    const veggiest = [...byProduct].sort((a, b) => b.vegs.length - a.vegs.length).slice(0, 5);
    const universal = byVeg.filter(
      (v) => brandsInScope.length > 1 && brandsInScope.every((b) => v.brands.has(b)),
    );

    const uniques: { veg: string; brand: string; count: number }[] = [];
    if (brandFilterId === "all") {
      for (const v of byVeg) {
        if (v.brands.size === 1) {
          const b = Array.from(v.brands)[0];
          uniques.push({ veg: v.label, brand: brandName.get(b) ?? "—", count: v.products.size });
        }
      }
      uniques.sort((a, b) => b.count - a.count);
    }

    const avgVeg = productsWithVeg.size
      ? (byProduct.reduce((s, p) => s + p.vegs.length, 0) / productsWithVeg.size).toFixed(1)
      : "0";

    const perBrandTop = new Map<string, { veg: string; count: number }>();
    for (const v of byVeg) {
      for (const b of v.brands) {
        const prodsInBrand = Array.from(v.products).filter(
          (pid) => catBrand.get(prodMap.get(pid)!.category_id) === b,
        ).length;
        const cur = perBrandTop.get(b);
        if (!cur || prodsInBrand > cur.count)
          perBrandTop.set(b, { veg: v.label, count: prodsInBrand });
      }
    }

    const totalAppearances = byVeg.reduce((s, v) => s + v.products.size, 0);

    return {
      productsWithVeg,
      brandLabel,
      topVegs,
      veggiest,
      universal,
      uniques,
      avgVeg,
      perBrandTop,
      totalAppearances,
    };
  }, [byVeg, byProduct, filteredLinks, brandFilterId, brandName, catBrand, prodMap]);

  const cards: { title: string; emoji: string; lines: string[] }[] = [];

  cards.push({
    title: "Vegetable Powerhouse",
    emoji: "🥬",
    lines: [
      `We work with ${byVeg.length} distinct vegetables ${facts.brandLabel}.`,
      `That's ${facts.totalAppearances.toLocaleString()} vegetable–product combinations across ${facts.productsWithVeg.size} dishes!`,
      `On average, each dish features ${facts.avgVeg} vegetables.`,
    ],
  });

  if (facts.topVegs.length) {
    cards.push({
      title: "Top 10 Most-Loved Vegetables",
      emoji: "⭐",
      lines: facts.topVegs.map(
        (v, i) =>
          `${i + 1}. ${v.label} — used in ${v.products.size} product${v.products.size === 1 ? "" : "s"} across ${v.brands.size} brand${v.brands.size === 1 ? "" : "s"}`,
      ),
    });
  }

  if (facts.veggiest.length) {
    cards.push({
      title: "Most Vegetable-Packed Dishes",
      emoji: "🍲",
      lines: facts.veggiest.map((p, i) => {
        const prod = prodMap.get(p.pid);
        const bn = brandName.get(catBrand.get(prod?.category_id ?? "") ?? "") ?? "—";
        return `${i + 1}. ${prod?.name ?? "—"} (${bn}) — ${p.vegs.length} vegetables: ${p.vegs
          .slice(0, 6)
          .map((k) => keyLabel.get(k) ?? k)
          .join(", ")}${p.vegs.length > 6 ? "…" : ""}`;
      }),
    });
  }

  if (facts.universal.length && brandFilterId === "all" && brands.length > 1) {
    cards.push({
      title: "The Universal Heroes",
      emoji: "🌟",
      lines: [
        `${facts.universal.length} vegetable${facts.universal.length === 1 ? " is" : "s are"} used by EVERY brand in our kitchens:`,
        facts.universal.map((v) => v.label).join(", "),
      ],
    });
  }

  if (facts.uniques.length) {
    cards.push({
      title: "Brand-Signature Vegetables",
      emoji: "🎯",
      lines: facts.uniques
        .slice(0, 8)
        .map(
          (u) => `${u.veg} — only at ${u.brand} (${u.count} product${u.count === 1 ? "" : "s"})`,
        ),
    });
  }

  if (facts.perBrandTop.size > 1 && brandFilterId === "all") {
    cards.push({
      title: "Each Brand's Star Vegetable",
      emoji: "👑",
      lines: Array.from(facts.perBrandTop.entries())
        .map(([b, v]) => `${brandName.get(b) ?? "—"}: ${v.veg} (in ${v.count} products)`)
        .sort(),
    });
  }

  cards.push({
    title: "Scale of Variety",
    emoji: "📊",
    lines: [
      `${facts.productsWithVeg.size} of ${productsTotal} menu items celebrate vegetables (${Math.round((facts.productsWithVeg.size / Math.max(productsTotal, 1)) * 100)}%).`,
      `${productsTotal - facts.productsWithVeg.size} items are vegetable-free (rice, breads, sweets, pickles, etc.).`,
    ],
  });

  const copyCard = async (lines: string[], title: string) => {
    const text = `${title}\n${lines.map((l) => `• ${l}`).join("\n")}`;
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const copyAll = async () => {
    const text = cards
      .map((c) => `${c.emoji} ${c.title}\n${c.lines.map((l) => `• ${l}`).join("\n")}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("All fun facts copied — paste into your deck!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Wow-facts for partner presentations. Filter by brand above, then copy any card.
        </p>
        <Button size="sm" onClick={copyAll}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copy all
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((c, i) => (
          <div
            key={i}
            className="group relative rounded-xl border border-border bg-surface-elevated p-4"
          >
            <button
              type="button"
              onClick={() => copyCard(c.lines, `${c.emoji} ${c.title}`)}
              className="absolute right-3 top-3 rounded-md border border-border bg-background p-1.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 print:hidden"
              title="Copy this card"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{c.emoji}</span>
              <h3 className="font-display text-sm font-semibold">{c.title}</h3>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {c.lines.map((l, j) => (
                <li key={j} className="leading-relaxed">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
