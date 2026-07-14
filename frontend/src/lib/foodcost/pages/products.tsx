import { Link, useNavigate } from "@tanstack/react-router";
import { uploadToStorage, getSignedUrl, uploadImageAndGetPath } from "@/lib/api/storage";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Upload, X, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import type {
  Product,
  Brand,
  Category,
  FcStatus,
  FcCurrencyMode,
  FcVegMode,
  Ingredient,
} from "@/lib/foodcost/types";
import { fmt } from "@/lib/foodcost/types";
import {
  useFoodcostCountry,
  COUNTRY_LABEL,
  countryField,
  countryCurrency,
} from "@/lib/foodcost/country";
import { BulkUpload, type BulkColumn } from "@/components/foodcost/bulk-upload";
import { StatusPill } from "./brands";
import { generateMenuDescription } from "@/lib/foodcost/menu-description.functions";

type EditProduct = Partial<Product> & { image_url?: string | null };

function genCode(brand: Brand | undefined, _name: string, existing: Product[]) {
  const prefix =
    (brand?.code_prefix || brand?.code || "PRD")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "PRD";
  const brandRows = brand ? existing.filter((p) => p.brand_id === brand.id) : [];
  const taken = new Set(brandRows.map((p) => p.code));
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const p of brandRows) {
    const m = p.code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  let n = max + 1;
  let code = `${prefix}-${String(n).padStart(3, "0")}`;
  while (taken.has(code)) {
    n++;
    code = `${prefix}-${String(n).padStart(3, "0")}`;
  }
  return code;
}

export function ProductsPage() {
  const { isEditor } = useRoles();
  const country = useFoodcostCountry();
  const navigate = useNavigate();

  async function createRecipeForProduct(productId: string) {
    const ccy = (country ? countryCurrency(country) : "inr").toLowerCase() as "inr" | "usd";

    try {
      const { data: existingRecipes } = await api.get("/foodcost/recipes", {
        params: { product_id: productId },
      });
      const existing = Array.isArray(existingRecipes) ? existingRecipes[0] : existingRecipes;
      if (existing?.id) {
        navigate({ to: "/foodcost/recipes/$recipeId", params: { recipeId: existing.id } });
        return;
      }

      const { data: rec } = await api.post("/foodcost/recipes", {
        product_id: productId,
        status: "approved",
      });
      if (!rec?.id) {
        throw new Error("Could not create recipe");
      }

      const { data: ver } = await api.post("/foodcost/recipe-versions", {
        recipe_id: rec.id,
        version_no: 1,
        currency: ccy,
        status: "approved",
        approved_at: new Date().toISOString(),
      });
      if (!ver?.id) {
        throw new Error("Could not create recipe version");
      }

      await api.patch(`/foodcost/recipes/${rec.id}`, { current_version_id: ver.id });
      navigate({ to: "/foodcost/recipes/$recipeId", params: { recipeId: rec.id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const [rows, setRows] = useState<(Product & { image_url?: string | null })[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [veggies, setVeggies] = useState<Ingredient[]>([]);
  const [recipeMap, setRecipeMap] = useState<Map<string, string>>(new Map());
  const [costMap, setCostMap] = useState<Map<string, number | null>>(new Map());
  const [edit, setEdit] = useState<EditProduct | null>(null);
  const [costPreview, setCostPreview] = useState<{ inr: number | null; usd: number | null }>({
    inr: null,
    usd: null,
  });
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const genDesc = generateMenuDescription;
  const [q, setQ] = useState("");
  const [brandF, setBrandF] = useState("all");
  const [catF, setCatF] = useState("all");

  async function load() {
    const activeField = country ? countryField(country) : null;
    const [pRes, bRes, cRes, vRes] = await Promise.all([
      api.get("/foodcost/products", { params: { country: country ?? undefined } }),
      api.get("/foodcost/brands", { params: { country: country ?? undefined } }),
      api.get("/foodcost/categories", { params: { country: country ?? undefined } }),
      api.get("/foodcost/ingredients", { params: { country: country ?? undefined } }),
    ]);
    const pData = (pRes.data ?? []) as (Product & { image_url?: string | null })[];
    const bData = (bRes.data ?? []) as Brand[];
    const cData = (cRes.data ?? []) as Category[];
    const vData = (vRes.data ?? []) as Ingredient[];
    const rows = activeField
      ? pData.filter((row) => (row as Record<string, unknown>)[activeField] === true)
      : pData;
    setRows(rows);
    setBrands(bData);
    setCats(cData);
    setVeggies(vData.slice().sort((a, b) => a.name.localeCompare(b.name)));

    // Map product_id -> recipe_id for any existing product recipe
    const recipesRes = await api.get("/foodcost/recipes", { params: { country: country ?? undefined } });
    const recRows = ((recipesRes.data ?? []) as { id: string; product_id: string | null; current_version_id: string | null }[]).filter(
      (row) => !!row.product_id,
    );
    const recRowsData = (recipesRes.data ?? []) as {
      id: string;
      product_id: string;
      current_version_id: string | null;
    }[];
    const m = new Map<string, string>();
    for (const r of recRows) if (!m.has(r.product_id)) m.set(r.product_id, r.id);
    setRecipeMap(m);

    // Fetch food cost per product for the active country currency
    const ccy = (country ? countryCurrency(country) : "inr").toLowerCase() as "inr" | "usd";
    const products = (p.data ?? []) as { id: string }[];
    const results = await Promise.all(
      products.map((pr) =>
        api.post("/foodcost/rpc/fc-product-cost", { _product_id: pr.id, _currency: ccy }),
      ),
    );
    const cm = new Map<string, number | null>();
    products.forEach((pr, i) => cm.set(pr.id, (results[i].data as number | null) ?? null));
    setCostMap(cm);
  }
  useEffect(() => {
    load();
  }, [country]);

  // Live cost preview while editing
  useEffect(() => {
    if (!edit?.id) {
      setCostPreview({ inr: null, usd: null });
      return;
    }
    const pid = edit.id;
    let cancelled = false;
    (async () => {
      const [a, b] = await Promise.all([
        api.post("/foodcost/rpc/fc-product-cost", { _product_id: pid, _currency: "inr" }),
        api.post("/foodcost/rpc/fc-product-cost", { _product_id: pid, _currency: "usd" }),
      ]);
      if (!cancelled)
        setCostPreview({ inr: a.data as number | null, usd: b.data as number | null });
    })();
    return () => {
      cancelled = true;
    };
  }, [edit?.id, edit?.veg_mode, edit?.veg_ingredient_ids, edit?.veg_qty_override]);

  const activeCatIds = useMemo(
    () => new Set(cats.filter((c) => c.status === "active").map((c) => c.id)),
    [cats],
  );
  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);
  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!activeCatIds.has(r.category_id)) return false;
        if (brandF !== "all" && r.brand_id !== brandF) return false;
        if (catF !== "all" && r.category_id !== catF) return false;
        if (q) {
          const hay = `${r.name} ${r.code}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [rows, q, brandF, catF, activeCatIds, catName, brandName],
  );

  const catsForBrand = (bId?: string) =>
    cats.filter((c) => c.status === "active" && (!bId || c.brand_id === bId));

  async function handleImage(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const uploadErr = await uploadToStorage("fc-products", path, file);
    if (uploadErr) {
      setUploading(false);
      return toast.error(uploadErr);
    }
    const url = await getSignedUrl("fc-products", path);
    setEdit((e) => ({ ...e!, image_url: url ?? path }));
    setUploading(false);
  }

  async function save() {
    if (!edit?.name?.trim() || !edit?.brand_id || !edit?.category_id) {
      return toast.error("Brand, category, and name required");
    }
    const brand = brands.find((b) => b.id === edit.brand_id);
    // Fetch ALL products globally (not just country-filtered rows) so generated
    // code doesn't collide with products active only in the other country.
    const allProducts = await api.get("/foodcost/products", {
      params: { country: country ?? undefined },
    });
    const globalRows = ((allProducts.data ?? []) as Product[]).filter((r) => r.id !== edit.id);
    const code = edit.code?.trim() || genCode(brand, edit.name, globalRows);
    const defaultMode: FcCurrencyMode =
      country === "in" ? "inr" : country === "us" ? "usd" : "both";
    const payload = {
      brand_id: edit.brand_id,
      category_id: edit.category_id,
      name: edit.name,
      code,
      description: edit.description ?? null,
      menu_description: edit.menu_description ?? null,
      image_url: edit.image_url ?? null,
      currency_mode: (edit.currency_mode ?? defaultMode) as FcCurrencyMode,
      status: (edit.status ?? "active") as FcStatus,
      active_in: edit.active_in ?? country !== "us",
      active_us: edit.active_us ?? country === "us",
      veg_mode: (edit.veg_mode ?? "none") as FcVegMode,
      veg_ingredient_ids: edit.veg_ingredient_ids ?? [],
      veg_qty_override: edit.veg_qty_override ?? null,
      serves_label: edit.serves_label ?? null,
      spice_level: Math.max(0, Math.min(3, Number(edit.spice_level ?? 0))),
      allergens: edit.allergens ?? [],
      menu_position: edit.menu_position ?? 0,
      available: edit.available ?? true,
    };
    const { error } = edit.id
      ? await api.patch(`/foodcost/products/${edit.id}`, payload).then((r) => r.data)
      : await api.post("/foodcost/products", payload).then((r) => r.data);
    if (error) {
      if (error.message?.includes("fc_products_code_key")) {
        return toast.error(
          `Product code "${code}" already exists. Clear the code field to auto-generate, or enter a different one.`,
        );
      }
      return toast.error(error.message);
    }
    toast.success("Saved");
    setEdit(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-semibold mr-auto">
          Product / Item Master{" "}
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
        <Select
          value={brandF}
          onValueChange={(v) => {
            setBrandF(v);
            setCatF("all");
          }}
        >
          <SelectTrigger className="w-44">
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
        <Select value={catF} onValueChange={setCatF}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {catsForBrand(brandF === "all" ? undefined : brandF).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEditor && (
          <ProductBulk
            brands={brands}
            cats={cats}
            country={country}
            existing={rows}
            onDone={load}
          />
        )}
        {isEditor && (
          <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
            <DialogTrigger asChild>
              <Button onClick={() => setEdit({ status: "active", currency_mode: "both" })}>
                <Plus className="mr-2 h-4 w-4" />
                New product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{edit?.id ? "Edit product" : "New product"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Brand">
                  <Select
                    value={edit?.brand_id ?? ""}
                    onValueChange={(v) => setEdit({ ...edit, brand_id: v, category_id: undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Category">
                  <Select
                    value={edit?.category_id ?? ""}
                    onValueChange={(v) => setEdit({ ...edit, category_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {catsForBrand(edit?.brand_id).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Product name">
                  <Input
                    value={edit?.name ?? ""}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </Field>
                <Field label="Product code (auto)">
                  <Input
                    value={
                      edit?.code ??
                      (edit?.name && edit?.brand_id
                        ? genCode(
                            brands.find((b) => b.id === edit.brand_id),
                            edit.name,
                            rows.filter((r) => r.id !== edit?.id),
                          )
                        : "")
                    }
                    placeholder="Auto-generated on save"
                    onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
                  />
                </Field>
                {!country && (
                  <Field label="Currency">
                    <Select
                      value={edit?.currency_mode ?? "both"}
                      onValueChange={(v) =>
                        setEdit({ ...edit, currency_mode: v as FcCurrencyMode })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inr">INR only</SelectItem>
                        <SelectItem value="usd">USD only</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
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
                <div className="col-span-2">
                  <Field label="Picture">
                    <div className="flex items-center gap-3">
                      {edit?.image_url ? (
                        <div className="relative">
                          <img
                            src={edit.image_url}
                            alt=""
                            className="h-20 w-20 rounded-lg object-cover border border-border"
                          />
                          <button
                            type="button"
                            onClick={() => setEdit({ ...edit, image_url: null })}
                            className="absolute -right-2 -top-2 rounded-full bg-background border border-border p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-20 w-20 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                          <Upload className="h-5 w-5" />
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])}
                        />
                        <span className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent/10">
                          {uploading ? "Uploading…" : edit?.image_url ? "Replace" : "Upload image"}
                        </span>
                      </label>
                    </div>
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Description (internal)">
                    <Textarea
                      rows={2}
                      value={edit?.description ?? ""}
                      onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                      placeholder="Short internal description…"
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Menu description (customer-facing)">
                    <div className="space-y-2">
                      <Textarea
                        rows={4}
                        value={edit?.menu_description ?? ""}
                        onChange={(e) => setEdit({ ...edit, menu_description: e.target.value })}
                        placeholder="e.g. 250 ml tub · Serves 3–4 — Bright tamarind-tang sambar, medium-thick…"
                      />
                      {edit?.id && recipeMap.get(edit.id) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={generating}
                          onClick={async () => {
                            if (!edit?.id) return;
                            setGenerating(true);
                            try {
                              const ccy = country ? countryCurrency(country) : "inr";
                              const r = await genDesc({
                                product_name: edit.name ?? "",
                                ingredients: edit.description ?? "",
                                language: "en",
                              });
                              if (!r.hadRecipe)
                                toast.warning(
                                  "No recipe linked — generated without ingredient anchor",
                                );
                              setEdit((e) => ({ ...e!, menu_description: r.description }));
                              toast.success("Description generated");
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Failed");
                            } finally {
                              setGenerating(false);
                            }
                          }}
                        >
                          <Sparkles className="mr-1 h-3 w-3" />
                          {generating ? "Generating…" : "Generate from recipe"}
                        </Button>
                      )}
                      {edit?.id && !recipeMap.get(edit.id) && (
                        <p className="text-xs text-muted-foreground">
                          Link a recipe to this product to enable AI generation.
                        </p>
                      )}
                    </div>
                  </Field>
                </div>
                <Field label="Serves / pack label">
                  <Input
                    value={edit?.serves_label ?? ""}
                    onChange={(e) => setEdit({ ...edit, serves_label: e.target.value })}
                    placeholder="Serves 1 / 250 ml"
                  />
                </Field>
                <Field label="Spice level (0–3)">
                  <Input
                    type="number"
                    min={0}
                    max={3}
                    value={edit?.spice_level ?? 0}
                    onChange={(e) => setEdit({ ...edit, spice_level: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Menu position (lower = first)">
                  <Input
                    type="number"
                    value={edit?.menu_position ?? 0}
                    onChange={(e) => setEdit({ ...edit, menu_position: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Available today">
                  <Select
                    value={(edit?.available ?? true) ? "yes" : "no"}
                    onValueChange={(v) => setEdit({ ...edit, available: v === "yes" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Available</SelectItem>
                      <SelectItem value="no">Sold out</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="col-span-2">
                  <Field label="Allergens (comma-separated, e.g. dairy, gluten, nuts)">
                    <Input
                      value={(edit?.allergens ?? []).join(", ")}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          allergens: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="col-span-2 border-t border-border pt-3 mt-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Vegetable slot
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Mode">
                      <Select
                        value={edit?.veg_mode ?? "none"}
                        onValueChange={(v) =>
                          setEdit({
                            ...edit,
                            veg_mode: v as FcVegMode,
                            veg_ingredient_ids: v === "mix" ? [] : (edit?.veg_ingredient_ids ?? []),
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No vegetable</SelectItem>
                          <SelectItem value="single">Single vegetable</SelectItem>
                          <SelectItem value="multi">Multiple named (equal split)</SelectItem>
                          <SelectItem value="mix">Mix veg (auto: 5 near median)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Qty override (blank = use category slot)">
                      <Input
                        type="number"
                        step="0.01"
                        value={edit?.veg_qty_override ?? ""}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            veg_qty_override: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                    {(edit?.veg_mode === "single" || edit?.veg_mode === "multi") && (
                      <div className="col-span-2">
                        <Field
                          label={
                            edit?.veg_mode === "single" ? "Vegetable" : "Vegetables (50/50 etc.)"
                          }
                        >
                          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto rounded-md border border-border p-2">
                            {veggies.map((v) => {
                              const sel = (edit?.veg_ingredient_ids ?? []).includes(v.id);
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => {
                                    const cur = edit?.veg_ingredient_ids ?? [];
                                    const next =
                                      edit?.veg_mode === "single"
                                        ? sel
                                          ? []
                                          : [v.id]
                                        : sel
                                          ? cur.filter((x) => x !== v.id)
                                          : [...cur, v.id];
                                    setEdit({ ...edit, veg_ingredient_ids: next });
                                  }}
                                  className={`px-2 py-1 rounded text-xs border ${sel ? "bg-accent text-accent-foreground border-accent" : "border-border bg-background"}`}
                                >
                                  {v.name}
                                </button>
                              );
                            })}
                            {veggies.length === 0 && (
                              <span className="text-xs text-muted-foreground">
                                No active vegetables in ingredient master.
                              </span>
                            )}
                          </div>
                        </Field>
                      </div>
                    )}
                  </div>
                  {edit?.id && (
                    <div className="mt-3 flex gap-4 text-sm">
                      <div>
                        Cost (INR):{" "}
                        <span className="font-mono tabular-nums">
                          {fmt(costPreview.inr, "inr")}
                        </span>
                      </div>
                      <div>
                        Cost (USD):{" "}
                        <span className="font-mono tabular-nums">
                          {fmt(costPreview.usd, "usd")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground self-end">save to refresh</div>
                    </div>
                  )}
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button onClick={save} disabled={uploading}>
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-surface-elevated">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left w-16">Image</th>
              <th className="px-4 py-2 text-left w-20">Code</th>
              <th className="px-4 py-2 text-left w-65">Product</th>
              <th className="px-4 py-2 text-left">Category</th>
              {!country && <th className="px-4 py-2 text-left w-20">Currency</th>}
              <th className="px-4 py-2 text-right w-28">Food Cost</th>
              <th className="px-4 py-2 text-left w-20">Status</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No products.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2">
                  {r.image_url ? (
                    <img
                      src={r.image_url}
                      alt={r.name}
                      className="h-10 w-10 rounded object-cover border border-border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted" />
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{r.code}</td>
                <td className="px-4 py-2 font-medium w-65 max-w-65">
                  <div className="truncate">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground font-normal truncate">
                      {r.description}
                    </div>
                  )}
                </td>

                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {cats.find((c) => c.id === r.category_id)?.name}
                </td>
                {!country && <td className="px-4 py-2 uppercase text-xs">{r.currency_mode}</td>}
                <td className="px-4 py-2 text-right font-mono text-xs whitespace-nowrap">
                  {(() => {
                    const c = costMap.get(r.id);
                    const ccy = (country ? countryCurrency(country) : "inr").toLowerCase() as
                      "inr" | "usd";
                    return c == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      fmt(c, ccy)
                    );
                  })()}
                </td>
                <td className="px-4 py-2">
                  <StatusPill s={r.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {recipeMap.get(r.id) ? (
                    <Link
                      to="/foodcost/recipes/$recipeId"
                      params={{ recipeId: recipeMap.get(r.id)! }}
                      className="mr-2 text-xs text-accent hover:underline"
                    >
                      Recipe →
                    </Link>
                  ) : (
                    isEditor && (
                      <button
                        type="button"
                        onClick={() => createRecipeForProduct(r.id)}
                        className="mr-2 text-xs text-muted-foreground hover:underline"
                      >
                        + Recipe
                      </button>
                    )
                  )}
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
                        if (
                          !confirm(
                            `Delete product "${r.name}"? Linked recipes will also be removed.`,
                          )
                        )
                          return;
                        const recRes = await api.get("/foodcost/recipes", {
                          params: { country: country ?? undefined },
                        });
                        const recipeIds = ((recRes.data ?? []) as { id: string }[]).map((x) => x.id);
                        if (recipeIds.length) {
                          await api.delete(`/foodcost/recipes`, { params: { ids: recipeIds } });
                        }
                        const { error } = await api
                          .delete(`/foodcost/products/${r.id}`)
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

type ProdBulkRow = {
  brand_code: string;
  category_name: string;
  name: string;
  code?: string;
  description?: string;
};
function ProductBulk({
  brands,
  cats,
  country,
  existing,
  onDone,
}: {
  brands: Brand[];
  cats: Category[];
  country: ReturnType<typeof useFoodcostCountry>;
  existing: Product[];
  onDone: () => void;
}) {
  const brandByCode = new Map(brands.map((b) => [b.code.toUpperCase(), b]));
  const cols: BulkColumn<ProdBulkRow>[] = [
    {
      key: "brand_code",
      label: "Brand code",
      required: true,
      example: brands[0]?.code ?? "ACME",
      transform: (v) => String(v ?? "").toUpperCase(),
      validate: (v) => (brandByCode.has(String(v)) ? null : "unknown brand code"),
    },
    {
      key: "category_name",
      label: "Category name",
      required: true,
      example: cats[0]?.name ?? "Sauces",
      validate: (v, row) => {
        const b = brandByCode.get(String(row.brand_code ?? "").toUpperCase());
        if (!b) return null;
        return cats.some(
          (c) => c.brand_id === b.id && c.name.toLowerCase() === String(v).toLowerCase(),
        )
          ? null
          : "category not found for brand";
      },
    },
    { key: "name", label: "Product name", required: true, example: "Tomato Ketchup 500g" },
    { key: "code", label: "Code (optional, auto)", example: "" },
    { key: "description", label: "Description", example: "" },
  ];
  const defaultMode: FcCurrencyMode = country === "in" ? "inr" : country === "us" ? "usd" : "both";
  return (
    <BulkUpload
      entity="products"
      columns={cols}
      hint="Leave Code blank to auto-generate from brand + product name."
      onCommit={async (rows) => {
        const seen: Product[] = [...existing];
        const payload = rows.map((r) => {
          const b = brandByCode.get(r.brand_code)!;
          const cat = cats.find(
            (c) => c.brand_id === b.id && c.name.toLowerCase() === r.category_name.toLowerCase(),
          )!;
          const code = r.code?.trim() || genCode(b, r.name, seen);
          const row = {
            brand_id: b.id,
            category_id: cat.id,
            name: r.name,
            code,
            description: r.description || null,
            image_url: null,
            currency_mode: defaultMode,
            status: "active" as FcStatus,
            active_in: country !== "us",
            active_us: country === "us",
          };
          seen.push({
            ...row,
            id: crypto.randomUUID(),
            created_at: "",
            updated_at: "",
          } as unknown as Product);
          return row;
        });
        const { error } = await api.post("/foodcost/products", payload).then((r) => r.data);
        if (error) throw new Error(error.message);
        return { inserted: payload.length };
      }}
      onDone={onDone}
    />
  );
}
