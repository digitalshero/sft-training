import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { uploadToStorage, getSignedUrl } from "@/lib/api/storage";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type {
  Product,
  Category,
  Brand,
  PackingContainer,
  NutritionResult,
  NutriMacro,
  Ingredient,
  Prep,
  Recipe,
  RecipeItem,
  RecipeVersion,
  Unit,
} from "@/lib/foodcost/types";
import {
  fmt,
  nutriRange,
  fmtRange,
  nutritionBadges,
  filterAllergens,
  deriveAllergensFromIngredients,
} from "@/lib/foodcost/types";
import {
  useFoodcostCountry,
  COUNTRY_LABEL,
  countryField,
  countryCurrency,
} from "@/lib/foodcost/country";
import { Flame, PlayCircle, Printer, Upload, FileSpreadsheet, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computePricing } from "@/lib/foodcost/pricing";
import {
  createNutritionContext,
  resolveProductNutrition,
  resolveProductIngredients,
} from "@/lib/foodcost/nutrition-resolver";
import { useRoles } from "@/lib/use-roles";
import { exportXLSX, type ExportColumn } from "@/lib/export";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

async function fetchImageDataUrl(
  url: string,
): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

type ProductRow = Product & { image_url?: string | null };

type Pricing = {
  fc: number;
  ptrMargin: number;
  ppp: number;
  sheroMargin: number;
  mrp: number;
  packing: number;
};

function formatContainerSize(
  container: PackingContainer | undefined,
  units: Map<string, string>,
): string {
  if (!container?.size_qty) return "";
  const unitCode = container.size_unit_id ? (units.get(container.size_unit_id) ?? "") : "";
  const qty = Number(container.size_qty);
  const prettyQty = Number.isInteger(qty) ? String(qty) : qty.toFixed(1).replace(/\.0$/, "");
  return [prettyQty, unitCode].filter(Boolean).join(" ");
}

function formatPackLabel(
  container: PackingContainer | undefined,
  units: Map<string, string>,
): string {
  if (!container) return "Pack set";
  const size = formatContainerSize(container, units);
  const name = (container.name ?? "").trim();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  if (!name) return size;
  if (!size) return name;
  if (norm(name) === norm(size) || norm(name).includes(norm(size))) return name;
  return `${size} ${name}`;
}

function servesFromOz(container: PackingContainer | undefined, units: Map<string, string>): string {
  if (!container?.size_qty) return "";
  const unitCode = container.size_unit_id ? (units.get(container.size_unit_id) ?? "") : "";
  if (!/^fl\s?oz$|^oz$/i.test(unitCode)) return "";
  const qty = Number(container.size_qty);
  if (qty <= 16) return "Serves 3–4";
  if (qty >= 24) return "Serves 4–6";
  return "";
}

function formatServesLabel(
  product: ProductRow,
  category: Category | undefined,
  container?: PackingContainer,
  units?: Map<string, string>,
): string {
  if (container && units) {
    const ozServes = servesFromOz(container, units);
    if (ozServes) return ozServes;
  }
  const cleanedProductLabel = (product.serves_label ?? "").replace(/^serves\s*/i, "").trim();
  if (cleanedProductLabel) return `Serves ${cleanedProductLabel}`;
  const min = category?.serves_min ?? null;
  const max = category?.serves_max ?? null;
  if (min == null) return "";
  return max != null && max > min ? `Serves ${min}–${max}` : `Serves ${min}`;
}

function stripBrokenLead(description: string | null | undefined): string {
  if (!description) return "";
  let s = description
    .replace(/\r?\n+/g, " ")
    .replace(/[_*]+/g, " ")
    .trim();
  if (!s) return "";

  // Drop placeholder/garbage leads
  if (/^(unknown|\{\s*_?serves_?\s*\})/i.test(s)) {
    const idx = s.indexOf(".");
    if (idx >= 0) s = s.slice(idx + 1).trim();
  }

  // Repeatedly strip leading size tokens ("8 oz", "26 oz", "8 Nos"),
  // serves phrases ("Serves 2-3 X 1 meal", "Serves 2-3 people"), and
  // separators (· • | , . - – —) so the actual description text remains.
  const leadRe =
    /^\s*(?:\d+(?:\.\d+)?\s*(?:fl\s?oz|oz|ml|kg|g|l|nos)\b|serves?\s*\d+(?:\s*[-–—]\s*\d+)?(?:\s+people)?(?:\s*x\s*\d+\s*meals?)?|[·•|,.\-–—:])\s*/i;
  let guard = 20;
  while (guard-- > 0 && leadRe.test(s)) s = s.replace(leadRe, "");

  // Remove any stray "Serves N - M X 1 meal" anywhere in the body too.
  s = s
    .replace(/\s*serves?\s*\d+(?:\s*[-–—]\s*\d+)?(?:\s+people)?(?:\s*x\s*\d+\s*meals?)?\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[.·•|,\-–—:]+\s*/, "")
    .trim();

  return s;
}

function priceFor(
  _cat: Category | undefined,
  fc: number,
  container: PackingContainer | undefined,
  ccy: "inr" | "usd",
): Pricing {
  const packing = container
    ? Number(ccy === "inr" ? container.price_inr : container.price_usd) || 0
    : 0;
  return computePricing(fc, packing);
}

function SpiceIcons({ level }: { level: number }) {
  if (!level) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-red-500"
      title={`Spice level ${level}/3`}
    >
      {Array.from({ length: level }).map((_, i) => (
        <Flame key={i} className="h-3 w-3 fill-current" />
      ))}
    </span>
  );
}

function VegDot({ vegan }: { vegan: boolean }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-sm border-2 ${vegan ? "border-emerald-600" : "border-red-600"} flex items-center justify-center`}
      title={vegan ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${vegan ? "bg-emerald-600" : "bg-red-600"}`} />
    </span>
  );
}

function ProductImageCell({
  product,
  editable,
  onSaved,
}: {
  product: ProductRow;
  editable: boolean;
  onSaved: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useState<{ el: HTMLInputElement | null }>({ el: null })[0];

  async function handle(file: File) {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `menu/${product.id}-${Date.now()}.${ext}`;
      const uploadError = await uploadToStorage("learning-media", path, file);
      if (uploadError) throw new Error(uploadError);
      const publicUrl = await getSignedUrl("learning-media", path);
      if (!publicUrl) throw new Error("Could not create image URL");
      const { data, error } = await api
        .patch(`/foodcost/products/${product.id}`, { image_url: publicUrl })
        .then((r) => ({ data: r.data, error: null }))
        .catch((e) => ({ data: null, error: e }));
      if (error || !data) throw error ?? new Error("Failed to save image");
      onSaved(publicUrl);
      toast.success("Image updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative h-22 w-22 overflow-hidden rounded-xl bg-muted group">
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
          No image
        </div>
      )}
      {editable && (
        <>
          <input
            ref={(el) => {
              inputRef.el = el;
            }}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handle(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.el?.click()}
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 px-1 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100 print:hidden disabled:opacity-100"
            title={product.image_url ? "Change image" : "Upload image"}
          >
            <Upload className="h-3 w-3" />
            {busy ? "…" : product.image_url ? "Change" : "Upload"}
          </button>
        </>
      )}
    </div>
  );
}

export function MenuPage() {
  const { isEditor } = useRoles();
  const country = useFoodcostCountry();
  const ccy = country ? countryCurrency(country) : "inr";
  const [cats, setCats] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [containers, setContainers] = useState<Map<string, PackingContainer>>(new Map());
  const [unitCodes, setUnitCodes] = useState<Map<string, string>>(new Map());
  const [costMap, setCostMap] = useState<Map<string, number>>(new Map());
  const [nutriMap, setNutriMap] = useState<Map<string, NutritionResult>>(new Map());
  const [allergenMap, setAllergenMap] = useState<Map<string, string[]>>(new Map());
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState<string>("all");
  const [catId, setCatId] = useState<string>("all");

  async function load() {
    if (!country) return;
    const [cRes, bRes, pRes, pcRes, ingRes, unitsRes, prepsRes, recipesRes, versionsRes, recipeItemsRes] =
      await Promise.all([
        api.get("/foodcost/categories", { params: { country: country ?? undefined } }),
        api.get("/foodcost/brands", { params: { country: country ?? undefined } }),
        api.get("/foodcost/products", { params: { country: country ?? undefined } }),
        api.get("/foodcost/packing-containers", { params: { country: country ?? undefined } }),
        api.get("/foodcost/ingredients", { params: { country: country ?? undefined } }),
        api.get("/foodcost/units", { params: { country: country ?? undefined } }),
        api.get("/foodcost/preps", { params: { country: country ?? undefined } }),
        api.get("/foodcost/recipes", { params: { country: country ?? undefined } }),
        api.get("/foodcost/recipe-versions", { params: { country: country ?? undefined } }),
        api.get("/foodcost/fc-recipe-items"),
      ]);
    const catRows = ((cRes.data ?? []) as Category[]).slice().sort((a, b) => a.name.localeCompare(b.name));
    const prodRows = ((pRes.data ?? []) as ProductRow[])
      .slice()
      .sort((a, b) => (a.menu_position ?? 0) - (b.menu_position ?? 0) || a.name.localeCompare(b.name));
    setCats(catRows);
    setBrands(((bRes.data ?? []) as Brand[]).slice().sort((a, b) => a.name.localeCompare(b.name)));
    setProducts(prodRows);
    setContainers(new Map(((pcRes.data ?? []) as PackingContainer[]).map((x) => [x.id, x])));
    setUnitCodes(
      new Map(((unitsRes.data ?? []) as Unit[]).map((unit) => [unit.id, unit.code] as const)),
    );

    // Batch product costs
    const costs = await Promise.all(
      prodRows.map((pr) =>
        api.post("/foodcost/rpc/fc-product-cost", { _product_id: pr.id, _currency: ccy }),
      ),
    );
    const cm = new Map<string, number>();
    prodRows.forEach((pr, i) => cm.set(pr.id, Number(costs[i]?.data ?? 0)));
    setCostMap(cm);

    const nm = new Map<string, NutritionResult>();
    const catById = new Map(catRows.map((cat) => [cat.id, cat] as const));
    const nutritionContext = createNutritionContext({
      ingredients: (ingRes.data ?? []) as unknown as Ingredient[],
      preps: (prepsRes.data ?? []) as unknown as Prep[],
      recipes: (recipesRes.data ?? []) as unknown as Recipe[],
      versions: (versionsRes.data ?? []) as unknown as RecipeVersion[],
      items: (recipeItemsRes.data ?? []) as unknown as RecipeItem[],
      units: (unitsRes.data ?? []) as unknown as Unit[],
    });
    const am = new Map<string, string[]>();
    prodRows.forEach((product) => {
      const cat = catById.get(product.category_id) ?? null;
      const resolved = resolveProductNutrition(nutritionContext, product, cat);
      if (resolved.nutrition) nm.set(product.id, resolved.nutrition);
      const ings = resolveProductIngredients(nutritionContext, product, cat).ingredients.map(
        (r) => r.ing.name,
      );
      const names = [...ings, product.name].map((n) => String(n || "").toLowerCase());
      const tags = new Set<string>();
      for (const n of names) {
        if (/\bpeanut\b|verkadalai|groundnut/.test(n)) tags.add("Peanut");
        const hasMilk = /\bmilk\b/.test(n) && !/coconut\s*milk/.test(n);
        const hasCurd = /\bcurd\b|buttermilk|yog(h)?urt|\bthayir\b/.test(n);
        if (hasMilk || hasCurd) tags.add("Dairy");
      }
      am.set(product.id, Array.from(tags).sort());
    });

    setNutriMap(nm);
    setAllergenMap(am);
  }
  useEffect(() => { load(); /* eslint-disable-line */ }, [country]);

  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);

  const grouped = useMemo(() => {
    const filtered = products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.code ?? "").toLowerCase().includes(q.toLowerCase()),
    );
    const map = new Map<string, ProductRow[]>();
    for (const p of filtered) {
      if (!map.has(p.category_id)) map.set(p.category_id, []);
      map.get(p.category_id)!.push(p);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) => (a.menu_position ?? 0) - (b.menu_position ?? 0) || a.name.localeCompare(b.name),
      );
    }
    return map;
  }, [products, q]);

  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);

  function handleExportXLSX() {
    type Row = {
      category: string;
      brand: string;
      code: string;
      name: string;
      veg: string;
      spice: number;
      serves: string;
      pack: string;
      fc: number;
      ptrMargin: number;
      ppp: number;
      sheroMargin: number;
      mrp: number;
      description: string;
    };
    const rows: Row[] = [];
    for (const cat of cats) {
      if (brandId !== "all" && cat.brand_id !== brandId) continue;
      if (catId !== "all" && cat.id !== catId) continue;
      const items = grouped.get(cat.id) ?? [];
      const container = cat.packing_container_id
        ? containers.get(cat.packing_container_id)
        : undefined;
      for (const p of items) {
        const fc = costMap.get(p.id) ?? 0;
        const pr = priceFor(cat, fc, container, ccy);
        const productNutri = nutriMap.get(p.id);
        rows.push({
          category: catName.get(cat.id) ?? "",
          brand: brandName.get(cat.brand_id) ?? "",
          code: p.code ?? "",
          name: p.name,
          veg: (productNutri?.is_vegetarian ?? productNutri?.is_vegan ?? true) ? "Veg" : "Non-veg",
          spice: p.spice_level ?? 0,
          serves: p.serves_label ?? "",
          pack: container?.name ?? "",
          fc: Number(pr.fc.toFixed(2)),
          ptrMargin: Number(pr.ptrMargin.toFixed(2)),
          ppp: Number(pr.ppp.toFixed(2)),
          sheroMargin: Number(pr.sheroMargin.toFixed(2)),
          mrp: Number(pr.mrp.toFixed(2)),
          description: p.menu_description ?? "",
        });
      }
    }
    if (!rows.length) {
      toast.error("No products to export");
      return;
    }
    const cur = ccy.toUpperCase();
    const cols: ExportColumn<Row>[] = [
      { key: "category", label: "Category" },
      { key: "brand", label: "Brand" },
      { key: "code", label: "Code" },
      { key: "name", label: "Product" },
      { key: "veg", label: "Veg/Non-veg" },
      { key: "spice", label: "Spice" },
      { key: "serves", label: "Serves" },
      { key: "pack", label: "Pack" },
      { key: "fc", label: `FC (${cur})` },
      { key: "ptrMargin", label: `PTR Margin (${cur})` },
      { key: "ppp", label: `PPP (${cur})` },
      { key: "sheroMargin", label: `Shero Margin (${cur})` },
      { key: "mrp", label: `MRP (${cur})` },
      { key: "description", label: "Description" },
    ];
    exportXLSX(`menu-${country ?? "all"}-${new Date().toISOString().slice(0, 10)}`, rows, cols);
    toast.success("Excel exported");
  }

  async function handlePppDownload() {
    toast.info("Preparing PPP PDF…");
    type R = {
      name: string;
      pack: string;
      fc: number;
      ptr: number;
      ppp: number;
      imgUrl: string | null;
    };
    const rows: R[] = [];
    const filteredCats = cats.filter(
      (c) => (brandId === "all" || c.brand_id === brandId) && (catId === "all" || c.id === catId),
    );
    for (const cat of filteredCats) {
      const items = grouped.get(cat.id) ?? [];
      const container = cat.packing_container_id
        ? containers.get(cat.packing_container_id)
        : undefined;
      const pack = formatPackLabel(container, unitCodes);
      for (const p of items) {
        const fc = costMap.get(p.id) ?? 0;
        const pr = priceFor(cat, fc, container, ccy);
        rows.push({
          name: p.name,
          pack,
          fc: pr.fc,
          ptr: pr.ptrMargin,
          ppp: pr.ppp,
          imgUrl: p.image_url ?? null,
        });
      }
    }
    if (!rows.length) {
      toast.error("No products to export");
      return;
    }

    const images = await Promise.all(
      rows.map((r) => (r.imgUrl ? fetchImageDataUrl(r.imgUrl) : Promise.resolve(null))),
    );

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const cuisineLabel = brandId !== "all" ? (brandName.get(brandId) ?? "") : "All Cuisines";
    const sym = ccy === "inr" ? "Rs." : "$";
    doc.setFontSize(16);
    doc.text(`PPP Price List — ${cuisineLabel}`, 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      `${COUNTRY_LABEL[country ?? "in"]} · ${ccy.toUpperCase()} · ${new Date().toLocaleString()}`,
      40,
      56,
    );
    doc.setTextColor(0);

    const ROW_H = 56;
    const IMG = 44;
    autoTable(doc, {
      startY: 72,
      head: [["Image", "Name", "Pack Size", `FC (${sym})`, `PTR Margin (${sym})`, `PPP (${sym})`]],
      body: rows.map((r) => [
        "",
        r.name,
        r.pack,
        r.fc.toFixed(2),
        r.ptr.toFixed(2),
        r.ppp.toFixed(2),
      ]),
      styles: { fontSize: 9, cellPadding: 6, valign: "middle", minCellHeight: ROW_H },
      headStyles: { fillColor: [13, 148, 136] },
      columnStyles: {
        0: { cellWidth: IMG + 12, halign: "center" },
        1: { cellWidth: 200 },
        2: { cellWidth: 120 },
        3: { cellWidth: 80, halign: "right" },
        4: { cellWidth: 100, halign: "right" },
        5: { cellWidth: 80, halign: "right" },
      },
      margin: { left: 24, right: 24 },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const img = images[data.row.index];
          if (img) {
            const ratio = img.w / img.h || 1;
            let w = IMG,
              h = IMG;
            if (ratio > 1) h = IMG / ratio;
            else w = IMG * ratio;
            const x = data.cell.x + (data.cell.width - w) / 2;
            const y = data.cell.y + (data.cell.height - h) / 2;
            try {
              doc.addImage(img.data, x, y, w, h);
            } catch {
              /* ignore */
            }
          }
        }
      },
    });

    const slug =
      cuisineLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "menu";
    doc.save(`ppp-${slug}-${country ?? "all"}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PPP PDF downloaded");
  }

  return (
    <div className="space-y-6 crc-print">
      <div className="flex items-center gap-3 print:hidden">
        <div className="mr-auto">
          <h2 className="font-display text-lg font-semibold">
            Menu — Customer Price List
            {country && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({COUNTRY_LABEL[country]} · {ccy.toUpperCase()})
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            Grouped by category. PTR Margin = FC × 2, PPP = FC + PTR Margin, Shero Margin = FC ×
            1.6, MRP = PPP + Shero Margin.
          </p>
        </div>
        <Select
          value={brandId}
          onValueChange={(v) => {
            setBrandId(v);
            setCatId("all");
          }}
        >
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-48">
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
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product…"
          className="w-64"
        />
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1 h-3.5 w-3.5" /> Export PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportXLSX}>
          <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export Excel
        </Button>
        <Button size="sm" onClick={handlePppDownload}>
          <FileDown className="mr-1 h-3.5 w-3.5" /> PPP Download
        </Button>
      </div>
      <div className="hidden print:block">
        <h2 className="font-display text-xl font-semibold">
          Menu — Customer Price List
          {country && (
            <span className="ml-2 text-sm font-normal">
              ({COUNTRY_LABEL[country]} · {ccy.toUpperCase()})
            </span>
          )}
        </h2>
        {brandId !== "all" && <p className="text-xs">Brand: {brandName.get(brandId)}</p>}
        <p className="text-[10px] text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </div>

      <MenuStats
        cats={cats}
        grouped={grouped}
        costMap={costMap}
        containers={containers}
        ccy={ccy}
        brandId={brandId}
        catId={catId}
        q={q}
        brandName={brandName}
        units={unitCodes}
      />

      {cats
        .filter(
          (c) =>
            (brandId === "all" || c.brand_id === brandId) && (catId === "all" || c.id === catId),
        )
        .map((cat) => {
          const items = grouped.get(cat.id) ?? [];
          if (!items.length) return null;
          const container = cat.packing_container_id
            ? containers.get(cat.packing_container_id)
            : undefined;
          return (
            <section key={cat.id} className="rounded-2xl border border-border bg-surface-elevated">
              <header className="border-b border-border px-4 py-3">
                <div className="flex items-baseline gap-3">
                  <h3 className="font-display text-base font-semibold">{cat.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {items.length} product{items.length === 1 ? "" : "s"}
                  </span>
                  {cat.video_url && (
                    <a
                      href={cat.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      title="Watch recipe video"
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> Video
                    </a>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {brandName.get(cat.brand_id)}
                  </span>
                </div>
                {cat.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
                )}
              </header>

              <div className="divide-y divide-border">
                {items.map((p) => {
                  const fc = costMap.get(p.id) ?? 0;
                  const pr = priceFor(cat, fc, container, ccy);
                  const nutri = nutriMap.get(p.id);
                  const base = nutri?.base_per_100;
                  const withVeg = nutri?.with_veg ?? [];
                  const productVegan = nutri?.is_vegan ?? true;
                  const productVegetarian = nutri?.is_vegetarian ?? productVegan;
                  const productHasDairy = nutri?.has_dairy ?? false;
                  // Per-product macros: exact when veg slot is known, else range
                  const productVegIds = p.veg_ingredient_ids ?? [];
                  const productMacros: NutriMacro[] = (() => {
                    if (!base) return [];
                    if (!withVeg.length) return [base];
                    if (p.veg_mode === "none") return [base];
                    if (productVegIds.length) {
                      const matched = withVeg.filter((v) => productVegIds.includes(v.id));
                      if (matched.length) return matched;
                    }
                    return [base, ...withVeg]; // unknown veg → full range
                  })();

                  const prng = (k: keyof NutriMacro) =>
                    productMacros.length ? nutriRange(productMacros, k) : { min: 0, max: 0 };
                  const badges = base
                    ? nutritionBadges(
                        productMacros[0] ?? base,
                        productVegan,
                        p.name,
                        productHasDairy,
                      )
                    : [];
                  const packText = formatPackLabel(container, unitCodes);
                  const servesText =
                    formatServesLabel(p, cat, container, unitCodes) || "Serves set";
                  const cleanDescription = stripBrokenLead(p.menu_description);
                  return (
                    <article key={p.id} className="grid grid-cols-[88px_1fr_auto] gap-4 p-4">
                      <ProductImageCell
                        product={p}
                        editable={isEditor}
                        onSaved={(url) =>
                          setProducts((prev) =>
                            prev.map((x) => (x.id === p.id ? { ...x, image_url: url } : x)),
                          )
                        }
                      />

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <VegDot vegan={productVegetarian} />
                          <h4 className="font-medium">{p.name}</h4>
                          <SpiceIcons level={p.spice_level ?? 0} />
                          {!p.available && (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] uppercase text-red-500">
                              Sold out
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{packText}</span>
                          <span className="px-1.5 text-muted-foreground">·</span>
                          <span>{servesText}</span>
                        </p>
                        {cleanDescription && (
                          <p className="text-xs text-muted-foreground">{cleanDescription}</p>
                        )}

                        {base && (
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">Per 100 g/ml:</span>{" "}
                            {fmtRange(prng("kcal").min, prng("kcal").max, " cal", 0)} · Protein{" "}
                            {fmtRange(prng("protein").min, prng("protein").max)} · Fibre{" "}
                            {fmtRange(prng("fibre").min, prng("fibre").max)} · Fat{" "}
                            {fmtRange(prng("fat").min, prng("fat").max)}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {badges.map((b) => (
                            <span
                              key={b.label}
                              className={`rounded-full px-2 py-0.5 text-[10px] ${b.tone}`}
                            >
                              {b.label}
                            </span>
                          ))}
                          {(allergenMap.get(p.id) ?? []).map((a) => (
                            <span
                              key={a}
                              className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-500"
                            >
                              Contains {a}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-0.5 text-xs">
                        <PriceRow label="FC" value={fmt(pr.fc, ccy)} muted />
                        <PriceRow label="PTR Margin" value={fmt(pr.ptrMargin, ccy)} muted />
                        <PriceRow label="PPP" value={fmt(pr.ppp, ccy)} />
                        <PriceRow label="Shero Margin" value={fmt(pr.sheroMargin, ccy)} muted />
                        <PriceRow label="MRP" value={fmt(pr.mrp, ccy)} bold />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

      {cats.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No active categories yet.
        </div>
      )}
    </div>
  );
}

function PriceRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex w-40 items-baseline justify-between gap-3 ${muted ? "text-muted-foreground" : ""}`}
    >
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold text-foreground" : ""}`}>{value}</span>
    </div>
  );
}

function MenuStats({
  cats,
  grouped,
  costMap,
  containers,
  ccy,
  brandId,
  catId,
  q,
  brandName,
  units,
}: {
  cats: Category[];
  grouped: Map<string, ProductRow[]>;
  costMap: Map<string, number>;
  containers: Map<string, PackingContainer>;
  ccy: "inr" | "usd";
  brandId: string;
  catId: string;
  q: string;
  brandName: Map<string, string>;
  units: Map<string, string>;
}) {
  const visibleCats = cats.filter(
    (c) => (brandId === "all" || c.brand_id === brandId) && (catId === "all" || c.id === catId),
  );
  let prodCount = 0,
    available = 0,
    soldOut = 0,
    missingFc = 0;
  const fcVals: number[] = [],
    mrpVals: number[] = [];
  type CatRow = {
    cat: string;
    pack: string;
    n: number;
    fc: number[];
    mrp: number[];
    ptr: number[];
    shero: number[];
  };
  const byCat: CatRow[] = [];
  for (const cat of visibleCats) {
    const items = grouped.get(cat.id) ?? [];
    if (!items.length) continue;
    const container = cat.packing_container_id
      ? containers.get(cat.packing_container_id)
      : undefined;
    const pack = container ? formatPackLabel(container, units) : "—";
    const row: CatRow = {
      cat: cat.name,
      pack,
      n: items.length,
      fc: [],
      mrp: [],
      ptr: [],
      shero: [],
    };
    for (const p of items) {
      prodCount++;
      if (p.available === false) soldOut++;
      else available++;
      const fc = costMap.get(p.id) ?? 0;
      if (!fc) missingFc++;
      const pr = priceFor(cat, fc, container, ccy);
      fcVals.push(pr.fc);
      mrpVals.push(pr.mrp);
      row.fc.push(pr.fc);
      row.mrp.push(pr.mrp);
      row.ptr.push(pr.ptrMargin);
      row.shero.push(pr.sheroMargin);
    }
    byCat.push(row);
  }

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
  const sym = ccy === "inr" ? "₹" : "$";
  const f = (n: number) => `${sym}${n.toFixed(2)}`;
  const amm = (a: number[]) =>
    a.length ? `${f(avg(a))} / ${f(Math.min(...a))} / ${f(Math.max(...a))}` : "—";

  const filtersLabel = [
    brandId !== "all" ? `Brand: ${brandName.get(brandId) ?? ""}` : "All brands",
    catId !== "all"
      ? `Category: ${cats.find((c) => c.id === catId)?.name ?? ""}`
      : "All categories",
    q ? `Search: "${q}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handlePrintStats = () => {
    const node = document.getElementById("menu-stats-section");
    if (!node) return;
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Menu Stats</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;padding:20px;color:#111}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
        th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:right}
        th:first-child,td:first-child{text-align:left}
        thead th{color:#555;font-weight:600}
        tr.overall td{border-top:2px solid #333;font-weight:700}
        .hdr{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0}
        .stat{background:#f5f5f0;padding:8px 12px;border-radius:8px}
        .stat .l{font-size:10px;text-transform:uppercase;color:#666;letter-spacing:.05em}
        .stat .v{font-family:ui-monospace,monospace;font-size:14px;margin-top:2px}
        details>summary{display:none}
        details>div{display:block!important}
      </style></head><body>${node.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 300);
  };

  return (
    <div
      id="menu-stats-section"
      className="rounded-2xl border border-border bg-surface-elevated p-4 text-xs print:break-inside-avoid"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="font-semibold text-sm">Menu Stats (filtered)</span>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{filtersLabel}</span>
          <button
            type="button"
            onClick={handlePrintStats}
            title="Print Menu Stats"
            className="print:hidden inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted"
          >
            <Printer className="h-3 w-3" /> Print
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Stat label="Categories" value={byCat.length} />
        <Stat label="Products" value={prodCount} />
        <Stat label="Available / Sold out" value={`${available} / ${soldOut}`} />
        <Stat label="Missing FC" value={missingFc} />
      </div>
      {byCat.length > 0 && (
        <details className="mt-3 group" open>
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground print:hidden">
            By category ({byCat.length}) — values shown as Avg / Min / Max ({ccy.toUpperCase()})
          </summary>
          <div className="mt-2 print:!block overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Category</th>
                  <th className="text-left">Packing</th>
                  <th className="text-right">#</th>
                  <th className="text-right">FC (avg / min / max)</th>
                  <th className="text-right">PTR Margin (avg / min / max)</th>
                  <th className="text-right">Shero Margin (avg / min / max)</th>
                  <th className="text-right">MRP (avg / min / max)</th>
                </tr>
              </thead>
              <tbody>
                {byCat.map((r, i) => (
                  <tr
                    key={`${r.cat}-${i}`}
                    className={`border-t border-border/40 ${i % 2 === 1 ? "bg-muted/30" : ""}`}
                  >
                    <td className="py-1">{r.cat}</td>
                    <td className="py-1 text-muted-foreground">{r.pack}</td>
                    <td className="text-right tabular-nums">{r.n}</td>
                    <td className="text-right tabular-nums">{amm(r.fc)}</td>
                    <td className="text-right tabular-nums">{amm(r.ptr)}</td>
                    <td className="text-right tabular-nums">{amm(r.shero)}</td>
                    <td className="text-right tabular-nums">{amm(r.mrp)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-1">Overall</td>
                  <td />
                  <td className="text-right tabular-nums">{prodCount}</td>
                  <td className="text-right tabular-nums">{amm(fcVals)}</td>
                  <td className="text-right tabular-nums">{amm(byCat.flatMap((r) => r.ptr))}</td>
                  <td className="text-right tabular-nums">{amm(byCat.flatMap((r) => r.shero))}</td>
                  <td className="text-right tabular-nums">{amm(mrpVals)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}
