import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Leaf,
  Sparkles,
  Download,
  FileSpreadsheet,
  Printer,
  Save,
} from "lucide-react";
import { exportCSV, exportXLSX } from "@/lib/export";
import dummySambarVcr from "@/assets/dummy-sambar-vcr.jpeg";
import dummySambarHero from "@/assets/dummy-sambar-hero.jpeg";
import dummyPackingContainer from "@/assets/dummy-packing-container.png";

const DUMMY_SUFFIX = " — Dummy Cat Card";
const DUMMY_IMAGE = dummySambarHero;
const DUMMY_VIDEO = "https://www.youtube.com/watch?v=fXkQA6_7N_Q";
const DUMMY_COLOUR = "Mild reddish yellow";
const DUMMY_CONSISTENCY = "Medium-thick, pourable, not watery";
const DUMMY_TASTE =
  "Balanced — mild spice, good vegetable and dhal flavour, not oily";
import {
  toBase,
  fmt,
  type Ingredient,
  type Unit,
  type Prep,
  type Category,
  type Brand,
  type RecipeItem,
  type PackingContainer,
} from "@/lib/foodcost/types";
import {
  HeroImage,
  CostingCard,
  PackagingCard,
  VideoCard,
  SensoryCard,
  AbcCard,
  VcrPlaceholder,
  HealthCard,
  buildHealth,
} from "@/lib/foodcost/components/category-card-sections";
import { NutritionCard } from "@/lib/foodcost/components/nutrition-card";

export const Route = createFileRoute(
  "/_authenticated/foodcost/categories/$id/crc",
)({
  component: CrcEditor,
});

function CrcEditor() {
  const { id: categoryId } = Route.useParams();
  const { isEditor } = useRoles();

  const [category, setCategory] = useState<Category | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [preps, setPreps] = useState<Prep[]>([]);
  const [prepCosts, setPrepCosts] = useState<
    Record<string, { inr: number | null; usd: number | null }>
  >({});
  const [baseCostInr, setBaseCostInr] = useState<number>(0);
  const [baseCostUsd, setBaseCostUsd] = useState<number>(0);
  const [container, setContainer] = useState<PackingContainer | null>(null);
  const [availableContainers, setAvailableContainers] = useState<
    PackingContainer[]
  >([]);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [draftCategory, setDraftCategory] = useState<Category | null>(null);
  const [draftItems, setDraftItems] = useState<RecipeItem[]>([]);

  async function load() {
    const cat = await api
      .get(`/foodcost/categories/${categoryId}`)
      .then((r) => r.data)
      .catch(() => null);
    if (!cat) return;
    setCategory(cat as Category);
    setDraftCategory(cat as Category);

    if (cat.brand_id) {
      const b = await api
        .get(`/foodcost/brands/${cat.brand_id}`)
        .then((r) => r.data)
        .catch(() => null);
      setBrand(b as Brand | null);
    }

    if (cat.packing_container_id) {
      const pc = await api
        .get(`/foodcost/packing-containers/${cat.packing_container_id}`)
        .then((r) => r.data)
        .catch(() => null);
      setContainer(pc as PackingContainer | null);
    } else {
      setContainer(null);
    }

    const allPc = await api
      .get("/foodcost/packing-containers")
      .then((r) => r.data)
      .catch(() => []);
    setAvailableContainers(allPc as PackingContainer[]);

    const products = await api
      .get("/foodcost/products")
      .then((r) => r.data as Array<{ image_url?: string | null }>)
      .catch(() => [] as Array<{ image_url?: string | null }>);
    const prod = products.find((p) => p.image_url != null);
    setProductImageUrl(prod?.image_url ?? null);

    // Ensure a recipe + draft version exist for this category
    let rId = (cat as Category).crc_recipe_id ?? null;
    if (!rId) {
      const r = await api
        .post("/foodcost/recipes", {
          category_id: categoryId,
          status: "draft",
        })
        .then((r) => r.data)
        .catch(() => null);
      if (!r) {
        toast.error("Failed to create recipe");
        return;
      }
      rId = r.id;
      await api
        .patch(`/foodcost/categories/${categoryId}`, { crc_recipe_id: rId })
        .then((r) => r.data);
    }
    setRecipeId(rId);

    // Load recipe with all versions and their items (versions ordered desc by version_no)
    const recipeData = await api
      .get(`/foodcost/recipes/${rId}`)
      .then((r) => r.data)
      .catch(() => null);

    let ver = recipeData?.versions?.[0] ?? null;

    if (!ver) {
      ver = await api
        .post("/foodcost/recipe-versions", {
          recipe_id: rId,
          version_no: 1,
          status: "draft",
          currency: "inr",
        })
        .then((r) => r.data)
        .catch(() => null);
      if (!ver) {
        toast.error("Failed to create recipe version");
        return;
      }
      await api
        .patch(`/foodcost/recipes/${rId}`, { current_version_id: ver.id })
        .then((r) => r.data);
    } else {
      // Self-heal: ensure costing reads the latest version, not an older snapshot
      if (recipeData && recipeData.current_version_id !== ver.id) {
        await api
          .patch(`/foodcost/recipes/${rId}`, { current_version_id: ver.id })
          .then((r) => r.data);
      }
    }
    setVersionId(ver.id);

    // Items are embedded in the version; sort by position
    const versionItems = [...(ver.items ?? [])].sort(
      (a: RecipeItem, b: RecipeItem) => (a.position ?? 0) - (b.position ?? 0),
    );
    setItems(versionItems);
    setDraftItems(versionItems);

    const [ingData, uData, pData] = await Promise.all([
      api
        .get("/foodcost/ingredients")
        .then((r) => r.data)
        .catch(() => []),
      api
        .get("/foodcost/units")
        .then((r) => r.data)
        .catch(() => []),
      api
        .get("/foodcost/preps")
        .then((r) => r.data)
        .catch(() => []),
    ]);
    setIngredients(ingData as Ingredient[]);
    setUnits(uData as Unit[]);
    setPreps(pData as Prep[]);
    setPrepCosts({});

    const [bcInr, bcUsd] = await Promise.all([
      api
        .post("/foodcost/rpc/fc-category-base-cost", {
          _category_id: categoryId,
          _currency: "inr",
        })
        .then((r) => r.data)
        .catch(() => 0),
      api
        .post("/foodcost/rpc/fc-category-base-cost", {
          _category_id: categoryId,
          _currency: "usd",
        })
        .then((r) => r.data)
        .catch(() => 0),
    ]);
    setBaseCostInr(Number(bcInr ?? 0));
    setBaseCostUsd(Number(bcUsd ?? 0));
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [categoryId]);

  const editable = isEditor;
  const [saving, setSaving] = useState(false);

  async function saveAll() {
    if (!category) return;
    setSaving(true);
    try {
      // Force-flush every recipe line from local state to DB
      const persistedItems = draftItems.filter(
        (it) => !String(it.id).startsWith("draft-"),
      );
      const newItems = draftItems.filter((it) =>
        String(it.id).startsWith("draft-"),
      );
      const originalMap = new Map(items.map((it) => [it.id, it]));
      for (const it of persistedItems) {
        const original = originalMap.get(it.id);
        const patch = {
          ingredient_id: it.ingredient_id,
          prep_id: it.prep_id,
          qty: it.qty,
          unit_id: it.unit_id,
          wastage_pct: it.wastage_pct,
          is_veg_slot: it.is_veg_slot,
          notes: it.notes,
          position: it.position,
        };
        const previousPatch = {
          ingredient_id: original?.ingredient_id ?? null,
          prep_id: original?.prep_id ?? null,
          qty: original?.qty ?? null,
          unit_id: original?.unit_id ?? null,
          wastage_pct: original?.wastage_pct ?? null,
          is_veg_slot: original?.is_veg_slot,
          notes: original?.notes ?? null,
          position: original?.position ?? null,
        };
        if (JSON.stringify(patch) === JSON.stringify(previousPatch)) continue;
        const { error } = await api
          .patch(`/foodcost/recipe-items/${it.id}`, patch)
          .then((r) => r.data);
        if (error) throw error;
      }
      const removedIds = items
        .filter(
          (it) => !persistedItems.some((draftItem) => draftItem.id === it.id),
        )
        .map((it) => it.id);
      if (removedIds.length > 0) {
        const { error } = await api
          .delete(`/foodcost/recipe-items`, { params: { ids: removedIds } })
          .then((r) => r.data);
        if (error) throw error;
      }
      if (newItems.length > 0) {
        if (!versionId) throw new Error("Missing recipe version");
        const payload = newItems.map((it) => ({
          version_id: versionId,
          ingredient_id: it.ingredient_id,
          prep_id: it.prep_id,
          qty: it.qty,
          unit_id: it.unit_id,
          wastage_pct: it.wastage_pct,
          is_veg_slot: it.is_veg_slot,
          notes: it.notes,
          position: it.position,
        }));
        const { error } = await api
          .post("/foodcost/recipe-items", payload as never)
          .then((r) => r.data);
        if (error) throw error;
      }
      // Flush category-level veg slot fields
      const { error: catErr } = await api
        .patch(`/foodcost/categories/${category.id}`, {
          veg_slot_qty: draftCategory?.veg_slot_qty,
          veg_slot_unit_id: draftCategory?.veg_slot_unit_id,
        })
        .then((r) => r.data);
      if (catErr) throw catErr;
      await refreshBaseCost();
      await load();
      toast.success("Saved ✓ All changes confirmed");
    } catch (e) {
      toast.error((e as Error).message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function refreshBaseCost() {
    const [bcInr, bcUsd] = await Promise.all([
      api.post("/foodcost/rpc/fc-category-base-cost", {
        _category_id: categoryId,
        _currency: "inr",
      }),
      api.post("/foodcost/rpc/fc-category-base-cost", {
        _category_id: categoryId,
        _currency: "usd",
      }),
    ]);
    setBaseCostInr(Number(bcInr.data ?? 0));
    setBaseCostUsd(Number(bcUsd.data ?? 0));
  }

  async function addItem(asVegSlot = false) {
    if (!versionId) return;
    if (asVegSlot && draftItems.some((i) => i.is_veg_slot))
      return toast.error("Veg slot already exists");
    const ing = ingredients[0];
    if (!ing && !asVegSlot) return toast.error("Add ingredients first");
    const gUnit = units.find((u) => u.code === "g") ?? units[0];
    const draftItem: RecipeItem = asVegSlot
      ? {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          version_id: versionId,
          position: draftItems.length + 1,
          ingredient_id: null,
          prep_id: null,
          qty: Number(draftCategory?.veg_slot_qty ?? 100),
          unit_id: draftCategory?.veg_slot_unit_id ?? gUnit?.id ?? "",
          wastage_pct: 0,
          is_veg_slot: true,
          notes: "Vegetable slot",
        }
      : {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          version_id: versionId,
          position: draftItems.length + 1,
          ingredient_id: ing!.id,
          prep_id: null,
          qty: 0,
          unit_id: ing!.base_unit_id,
          wastage_pct: 0,
          is_veg_slot: false,
          notes: null,
        };
    setDraftItems([...draftItems, draftItem]);
    refreshBaseCost();
  }
  async function patchItem(id: string, patch: Partial<RecipeItem>) {
    setDraftItems(
      draftItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
    refreshBaseCost();
  }
  async function delItem(id: string) {
    setDraftItems(draftItems.filter((it) => it.id !== id));
    refreshBaseCost();
  }

  async function saveVegSlot(patch: {
    veg_slot_qty?: number;
    veg_slot_unit_id?: string;
  }) {
    if (!draftCategory) return;
    setDraftCategory({ ...draftCategory, ...patch });
    // If a veg slot row exists, mirror qty/unit
    const slot = draftItems.find((i) => i.is_veg_slot);
    if (slot) {
      const next: Partial<RecipeItem> = {};
      if (patch.veg_slot_qty != null) next.qty = patch.veg_slot_qty;
      if (patch.veg_slot_unit_id) next.unit_id = patch.veg_slot_unit_id;
      await patchItem(slot.id, next);
    }
  }

  const totalLines = draftItems.length;
  const vegSlotExists = useMemo(
    () => draftItems.some((i) => i.is_veg_slot),
    [draftItems],
  );

  // Sum unrounded line values and round once — matches fc_product_cost / Category Base Cost.
  const recipeSubTotalUsd = useMemo(() => {
    let total = 0;
    for (const it of draftItems) {
      if (it.is_veg_slot) continue;
      const u = units.find((x) => x.id === it.unit_id);
      let priceUsd = 0;
      let baseCode = "";
      if (it.prep_id) {
        const prep = preps.find((p) => p.id === it.prep_id);
        const base = units.find((x) => x.id === prep?.base_unit_id);
        priceUsd = Number(prepCosts[it.prep_id]?.usd ?? 0);
        baseCode = base?.code ?? "";
      } else if (it.ingredient_id) {
        const ing = ingredients.find((i) => i.id === it.ingredient_id);
        const base = units.find((x) => x.id === ing?.base_unit_id);
        priceUsd = Number(ing?.price_usd ?? 0);
        baseCode = base?.code ?? "";
      }
      if (!u || !baseCode) continue;
      const qtyInBase = toBase(Number(it.qty), u.code) / toBase(1, baseCode);
      total += qtyInBase * priceUsd;
    }
    return total;
  }, [draftItems, units, ingredients, preps, prepCosts]);

  if (!category)
    return <p className="text-muted-foreground">Loading category…</p>;

  const packingInr = container ? Number(container.price_inr) : 0;
  const packingUsd = container ? Number(container.price_usd) : 0;
  const checks = buildHealth({
    category,
    recipeItemCount: draftItems.filter((i) => !i.is_veg_slot).length,
    container,
    hasProductImage: !!productImageUrl,
    fcInr: baseCostInr,
    fcUsd: baseCostUsd,
  });

  const isDummy = category.name.endsWith(DUMMY_SUFFIX);

  async function seedDummy() {
    if (!category) return;
    const patch = {
      name: isDummy ? category.name : category.name + DUMMY_SUFFIX,
      hero_image_url: DUMMY_IMAGE,
      video_url: DUMMY_VIDEO,
      colour_note: DUMMY_COLOUR,
      consistency_note: DUMMY_CONSISTENCY,
      taste_note: DUMMY_TASTE,
      ppp_mode: "flat",
      mrp_mode: "flat",
      ppp_flat_inr: 80,
      mrp_flat_inr: 120,
    };
    const { error } = await api
      .patch(`/foodcost/categories/${category.id}`, patch)
      .then((r) => r.data);
    if (error) return toast.error(error.message);
    toast.success("Dummy Cat Card seeded");
    setCategory({ ...category, ...patch } as Category);
  }

  async function deleteDummy() {
    if (!category) return;
    const patch = {
      name: category.name.replace(DUMMY_SUFFIX, ""),
      hero_image_url: null,
      video_url: null,
      colour_note: null,
      consistency_note: null,
      taste_note: null,
      ppp_mode: "multiplier",
      mrp_mode: "multiplier",
      ppp_flat_inr: 0,
      mrp_flat_inr: 0,
    };
    const { error } = await api
      .patch(`/foodcost/categories/${category.id}`, patch)
      .then((r) => r.data);
    if (error) return toast.error(error.message);
    toast.success("Dummy data cleared");
    setCategory({ ...category, ...patch } as Category);
  }

  return (
    <div className="crc-print space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/foodcost"
          className="text-xs text-muted-foreground hover:text-foreground no-print"
        >
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Categories
        </Link>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Category Recipe Card
        </span>
        <div className="no-print flex items-center gap-2">
          {editable && (
            <Button size="sm" onClick={saveAll} disabled={saving}>
              <Save className="mr-1 h-3 w-3" />
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-3 w-3" />
            Print (A4)
          </Button>
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={seedDummy}>
                <Sparkles className="mr-1 h-3 w-3" />
                {isDummy ? "Re-seed dummy" : "Seed Dummy Card"}
              </Button>
              {isDummy && (
                <Button size="sm" variant="destructive" onClick={deleteDummy}>
                  <Trash2 className="mr-1 h-3 w-3" />
                  Delete dummy
                </Button>
              )}
            </>
          )}
        </div>
        <div className="ml-auto text-right">
          <div className="font-display text-xl font-semibold leading-tight">
            {category.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {brand?.name ?? "—"}
          </div>
        </div>
      </div>

      {/* Top: hero + costing + health */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_0.9fr]">
        <HeroImage
          category={category}
          fallbackUrl={productImageUrl}
          editable={editable}
          onSaved={(url) => setCategory({ ...category, hero_image_url: url })}
        />
        <CostingCard
          category={category}
          fcInr={baseCostInr}
          fcUsd={baseCostUsd}
          packingInr={packingInr}
          packingUsd={packingUsd}
          displayCurrency="usd"
        />
        <HealthCard checks={checks} />
      </div>

      {/* Packaging + Video + Nutrition */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PackagingCard
          container={container}
          units={units}
          fallbackImage={isDummy ? dummyPackingContainer : null}
          displayCurrency="usd"
          editable={editable}
          onSaved={(url) =>
            setContainer(
              container ? { ...container, image_url: url } : container,
            )
          }
          categoryId={category.id}
          categoryPackingImage={category.packing_image_url ?? null}
          onCategoryImageSaved={(url) =>
            setCategory({ ...category, packing_image_url: url })
          }
          availableContainers={availableContainers}
          onContainerLinked={async (newId) => {
            setCategory({ ...category, packing_container_id: newId });
            if (newId) {
              const { data: pc } = await api
                .get(`/foodcost/packing-containers/${newId}`)
                .then((r) => {
                  return { data: r.data, error: null };
                })
                .catch(() => {
                  return { data: null, error: null };
                });
              setContainer(pc as PackingContainer | null);
            } else setContainer(null);
            refreshBaseCost();
          }}
        />
        <VideoCard
          category={category}
          editable={editable}
          onSaved={(url) =>
            setCategory({ ...category, video_url: url || null })
          }
        />
        <NutritionCard categoryId={category.id} />
      </div>

      {/* Recipe + side base-cost / veg slot */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-surface-elevated">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display font-semibold">CRC Recipe</h2>
            <p className="text-xs text-muted-foreground">
              {totalLines} line{totalLines === 1 ? "" : "s"} · Vegetable slot{" "}
              {vegSlotExists ? "defined ✓" : "not set"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left w-10" />
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Ingredient / Pre-Prep</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-right">Line (USD)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {draftItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No lines. Add ingredients, preps, and a vegetable slot.
                    </td>
                  </tr>
                )}
                {draftItems.map((it) => {
                  const u = units.find((x) => x.id === it.unit_id);
                  if (it.is_veg_slot) {
                    return (
                      <tr
                        key={it.id}
                        className="border-b border-border/40 bg-accent/5 last:border-0"
                      >
                        <td className="px-3 py-2 text-center">
                          <Leaf className="inline h-3 w-3 text-emerald-600" />
                        </td>
                        <td className="px-3 py-2 text-xs uppercase text-emerald-700">
                          Veg slot
                        </td>
                        <td className="px-3 py-2 italic text-muted-foreground">
                          [Selected on each product]
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 w-24"
                            value={it.qty}
                            onChange={(e) =>
                              saveVegSlot({
                                veg_slot_qty: Number(e.target.value),
                              })
                            }
                            disabled={!editable}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={it.unit_id}
                            onValueChange={(v) =>
                              saveVegSlot({ veg_slot_unit_id: v })
                            }
                            disabled={!editable}
                          >
                            <SelectTrigger className="h-8 w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((uu) => (
                                <SelectItem key={uu.id} value={uu.id}>
                                  {uu.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-right text-xs italic text-muted-foreground">
                          + veg cost
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editable && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => delItem(it.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  }
                  const kind: "ingredient" | "prep" = it.prep_id
                    ? "prep"
                    : "ingredient";
                  let priceUsd = 0;
                  let baseCode = "";
                  if (it.prep_id) {
                    const prep = preps.find((p) => p.id === it.prep_id);
                    const base = units.find((x) => x.id === prep?.base_unit_id);
                    priceUsd = Number(prepCosts[it.prep_id]?.usd ?? 0);
                    baseCode = base?.code ?? "";
                  } else {
                    const ing = ingredients.find(
                      (i) => i.id === it.ingredient_id,
                    );
                    const base = units.find((x) => x.id === ing?.base_unit_id);
                    priceUsd = Number(ing?.price_usd ?? 0);
                    baseCode = base?.code ?? "";
                  }
                  const qtyInBase =
                    u && baseCode
                      ? toBase(Number(it.qty), u.code) / toBase(1, baseCode)
                      : 0;
                  const lineUsd = qtyInBase * priceUsd;
                  return (
                    <tr
                      key={it.id}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td />
                      <td className="px-3 py-1.5">
                        <Select
                          value={kind}
                          onValueChange={(v) => {
                            if (v === "prep") {
                              const p = preps[0];
                              if (!p) return toast.error("No preps available");
                              patchItem(it.id, {
                                ingredient_id: null,
                                prep_id: p.id,
                                unit_id: p.base_unit_id,
                              });
                            } else {
                              const i = ingredients[0];
                              if (!i)
                                return toast.error("No ingredients available");
                              patchItem(it.id, {
                                prep_id: null,
                                ingredient_id: i.id,
                                unit_id: i.base_unit_id,
                              });
                            }
                          }}
                          disabled={!editable}
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ingredient">
                              Ingredient
                            </SelectItem>
                            <SelectItem value="prep">Pre-Prep</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5">
                        {kind === "prep" ? (
                          <Select
                            value={it.prep_id ?? undefined}
                            onValueChange={(v) =>
                              patchItem(it.id, {
                                prep_id: v,
                                ingredient_id: null,
                                unit_id:
                                  preps.find((p) => p.id === v)?.base_unit_id ??
                                  it.unit_id,
                              })
                            }
                            disabled={!editable}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {preps.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} · {p.code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={it.ingredient_id ?? undefined}
                            onValueChange={(v) =>
                              patchItem(it.id, {
                                ingredient_id: v,
                                prep_id: null,
                                unit_id:
                                  ingredients.find((i) => i.id === v)
                                    ?.base_unit_id ?? it.unit_id,
                              })
                            }
                            disabled={!editable}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ingredients.map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 w-24"
                          value={it.qty}
                          onChange={(e) =>
                            patchItem(it.id, { qty: Number(e.target.value) })
                          }
                          disabled={!editable}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Select
                          value={it.unit_id}
                          onValueChange={(v) =>
                            patchItem(it.id, { unit_id: v })
                          }
                          disabled={!editable}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((uu) => (
                              <SelectItem key={uu.id} value={uu.id}>
                                {uu.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {fmt(lineUsd, "usd")}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {editable && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => delItem(it.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30 text-sm">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right font-medium text-muted-foreground"
                  >
                    Sub-total (excl. veg slot)
                  </td>
                  <td className="px-3 py-2 text-right font-display font-bold tabular-nums">
                    {fmt(recipeSubTotalUsd, "usd")}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {(() => {
            const exportRows = draftItems.map((it, idx) => {
              const u = units.find((x) => x.id === it.unit_id);
              if (it.is_veg_slot) {
                return {
                  position: idx + 1,
                  kind: "Veg Slot",
                  name: "[Selected on each product]",
                  qty: it.qty,
                  unit: u?.code ?? "",
                  line_usd: "+ veg cost",
                };
              }
              const kind = it.prep_id ? "Pre-Prep" : "Ingredient";
              let priceUsd = 0;
              let baseCode = "";
              let name = "";
              if (it.prep_id) {
                const prep = preps.find((p) => p.id === it.prep_id);
                const base = units.find((x) => x.id === prep?.base_unit_id);
                priceUsd = Number(prepCosts[it.prep_id]?.usd ?? 0);
                baseCode = base?.code ?? "";
                name = prep ? `${prep.name} · ${prep.code}` : "";
              } else {
                const ing = ingredients.find((i) => i.id === it.ingredient_id);
                const base = units.find((x) => x.id === ing?.base_unit_id);
                priceUsd = Number(ing?.price_usd ?? 0);
                baseCode = base?.code ?? "";
                name = ing?.name ?? "";
              }
              const qtyInBase =
                u && baseCode
                  ? toBase(Number(it.qty), u.code) / toBase(1, baseCode)
                  : 0;
              const lineUsd = qtyInBase * priceUsd;
              return {
                position: idx + 1,
                kind,
                name,
                qty: it.qty,
                unit: u?.code ?? "",
                line_usd: Number(lineUsd.toFixed(4)),
              };
            });
            const cols = [
              { key: "position", label: "#" },
              { key: "kind", label: "Kind" },
              { key: "name", label: "Ingredient / Pre-Prep" },
              { key: "qty", label: "Qty" },
              { key: "unit", label: "Unit" },
              { key: "line_usd", label: "Line (USD)" },
            ];
            const fname = `crc-${(category.name || "recipe").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
            return (
              <div className="border-t border-border p-3 flex flex-wrap items-center gap-2">
                {editable && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addItem(false)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add line
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addItem(true)}
                      disabled={vegSlotExists}
                    >
                      <Leaf className="mr-1 h-3 w-3" />
                      {vegSlotExists ? "Veg slot added" : "Add vegetable slot"}
                    </Button>
                  </>
                )}
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportCSV(fname, exportRows, cols)}
                    disabled={draftItems.length === 0}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportXLSX(fname, exportRows, cols)}
                    disabled={draftItems.length === 0}
                  >
                    <FileSpreadsheet className="mr-1 h-3 w-3" />
                    Excel
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <h3 className="text-sm font-semibold">Category Base Cost</h3>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Excludes vegetable slot. Each product adds its own veg cost.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">USD</span>
                <span className="font-display text-lg font-bold tabular-nums">
                  {fmt(baseCostUsd, "usd")}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <h3 className="text-sm font-semibold">Vegetable Slot</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Quantity
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draftCategory?.veg_slot_qty ?? 100}
                  onChange={(e) =>
                    saveVegSlot({ veg_slot_qty: Number(e.target.value) })
                  }
                  disabled={!editable}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <Select
                  value={draftCategory?.veg_slot_unit_id ?? undefined}
                  onValueChange={(v) => saveVegSlot({ veg_slot_unit_id: v })}
                  disabled={!editable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="g" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Each product in this category replaces the slot with its chosen
              vegetable(s). Mix Veg = average of 5 closest to median price.
            </p>
          </div>
        </div>
      </div>

      {/* Sensory + ABC */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SensoryCard
          category={category}
          editable={editable}
          onSaved={(patch) => setCategory({ ...category, ...patch })}
        />
        <AbcCard />
      </div>

      {/* VCR placeholder */}
      <VcrPlaceholder
        imageUrl={category.vcr_image_url || (isDummy ? dummySambarVcr : null)}
        categoryId={category.id}
        editable={editable}
        onSaved={(url) => setCategory({ ...category, vcr_image_url: url })}
      />
    </div>
  );
}
