import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useFoodcostCountry } from "@/lib/foodcost/country";
import { useRoles } from "@/lib/use-roles";
import { Plus, Trash2, ArrowLeft, Save } from "lucide-react";
import {
  MULTIPLIER_PRESETS,
  INGREDIENT_CATEGORIES,
  toBase,
  fmt,
  type Recipe,
  type RecipeVersion,
  type RecipeItem,
  type Ingredient,
  type Unit,
  type Product,
  type Brand,
  type Category,
  type FcPricingMode,
  type Prep,
} from "@/lib/foodcost/types";
import { BulkUpload, type BulkColumn } from "@/components/foodcost/bulk-upload";

export const Route = createFileRoute(
  "/_authenticated/foodcost/recipes/$recipeId",
)({ component: RecipeBuilder });

function RecipeBuilder() {
  const { recipeId } = Route.useParams();
  const { isEditor } = useRoles();
  const country = useFoodcostCountry();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [version, setVersion] = useState<RecipeVersion | null>(null);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [preps, setPreps] = useState<Prep[]>([]);
  const [prepCosts, setPrepCosts] = useState<
    Record<string, { inr: number | null; usd: number | null }>
  >({});
  const [draftVersion, setDraftVersion] = useState<RecipeVersion | null>(null);
  const [draftItems, setDraftItems] = useState<RecipeItem[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: r } = await api
      .get(`/foodcost/recipes/${recipeId}`)
      .then((r) => {
        return { data: r.data, error: null };
      })
      .catch(() => {
        return { data: null, error: null };
      });
    if (!r) return;
    setRecipe(r as Recipe);
    const { data: p } = r.product_id
      ? await api
          .get(`/foodcost/products/${r.product_id}`)
          .then((r) => {
            return { data: r.data, error: null };
          })
          .catch(() => {
            return { data: null, error: null };
          })
      : { data: null };
    if (p) {
      setProduct(p as Product);
      const [bRes, cRes] = await Promise.all([
        api.get("/foodcost/brands", {
          params: { country: country ?? undefined },
        }),
        api.get("/foodcost/categories", {
          params: { country: country ?? undefined },
        }),
      ]);
      setBrand((bRes.data ?? null) as Brand | null);
      setCategory((cRes.data ?? null) as Category | null);
    }
    let activeVersionId = r.current_version_id;
    if (!activeVersionId) {
      const { data: latest } = await api
        .get("/foodcost/fc-recipe-versions")
        .then((r) => r.data);
      activeVersionId = latest?.id ?? null;
      if (activeVersionId) {
        await api
          .patch(`/foodcost/recipes/${recipeId}`, {
            current_version_id: activeVersionId,
          })
          .then((r) => r.data);
        setRecipe({ ...(r as Recipe), current_version_id: activeVersionId });
      }
    }
    if (activeVersionId) {
      const { data: v } = await api
        .get(`/foodcost/recipe-versions/${activeVersionId}`)
        .then((r) => {
          return { data: r.data, error: null };
        })
        .catch(() => {
          return { data: null, error: null };
        });
      setVersion(v as RecipeVersion | null);
      setDraftVersion(v as RecipeVersion | null);
      const { data: it } = await api.get("/foodcost/recipe-items", {
        params: { country: country ?? undefined },
      });
      const orderedItems = ((it ?? []) as RecipeItem[]).sort(
        (a, b) => a.position - b.position,
      );
      setItems(orderedItems);
      setDraftItems(orderedItems);
    }
    // Region for filtering preps/ingredients comes from product flags
    const prod = p as Product | null;
    type ActiveField = "active_in" | "active_us";
    const activeField: ActiveField | null =
      prod?.active_in && !prod?.active_us
        ? "active_in"
        : prod?.active_us && !prod?.active_in
          ? "active_us"
          : null;
    const filterByField = <
      T extends { active_in?: boolean; active_us?: boolean },
    >(
      rows: T[],
    ) => (activeField ? rows.filter((row) => row[activeField] === true) : rows);
    const [iRes, uRes, pRes, pcAll] = await Promise.all([
      api.get("/foodcost/ingredients", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/units", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/preps", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/preps", {
        params: { country: country ?? undefined },
      }),
    ]);
    const ingredientRows = ((iRes.data ?? []) as Ingredient[]).sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
    const prepRows = ((pRes.data ?? []) as Prep[]).sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
    const filteredIngredients = filterByField(ingredientRows);
    const filteredPreps = filterByField(prepRows);
    setIngredients(filteredIngredients);
    setUnits((uRes.data ?? []) as Unit[]);
    setPreps(filteredPreps);
    const map: Record<string, { inr: number | null; usd: number | null }> = {};
    for (const row of (pcAll.data ?? []) as Array<{
      prep_id: string;
      unit_cost_inr: number | null;
      unit_cost_usd: number | null;
    }>) {
      map[row.prep_id] = { inr: row.unit_cost_inr, usd: row.unit_cost_usd };
    }
    setPrepCosts(map);
  }, [recipeId, country]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = isEditor;
  const hasUnsavedChanges =
    JSON.stringify(draftVersion) !== JSON.stringify(version) ||
    JSON.stringify(draftItems) !== JSON.stringify(items);

  const cost = useMemo(() => {
    if (!draftVersion) return 0;
    let total = 0;
    for (const it of draftItems) {
      const u = units.find((x) => x.id === it.unit_id);
      if (!u) continue;
      if (it.prep_id) {
        const prep = preps.find((p) => p.id === it.prep_id);
        const base = units.find((x) => x.id === prep?.base_unit_id);
        const c = prepCosts[it.prep_id];
        const unitCost = draftVersion.currency === "inr" ? c?.inr : c?.usd;
        if (!prep || !base || unitCost == null) continue;
        const qtyInBase = toBase(Number(it.qty), u.code) / toBase(1, base.code);
        total += qtyInBase * Number(unitCost);
      } else {
        const ing = ingredients.find((i) => i.id === it.ingredient_id);
        const base = units.find((x) => x.id === ing?.base_unit_id);
        if (!ing || !base) continue;
        const qtyInBase = toBase(Number(it.qty), u.code) / toBase(1, base.code);
        const price =
          draftVersion.currency === "inr"
            ? Number(ing.price_inr)
            : Number(ing.price_usd);
        total += qtyInBase * price;
      }
    }
    return total;
  }, [draftItems, draftVersion, ingredients, units, preps, prepCosts]);

  // Fixed pricing formula across all brands/categories:
  // PTR Margin = FC × 2, PPP = FC + PTR Margin, Shero Margin = FC × 1.6, MRP = PPP + Shero Margin.
  const ptrMargin = cost * 2;
  const ppp = cost + ptrMargin;
  const sheroMargin = cost * 2;
  const mrp = ppp + sheroMargin;

  async function addItem() {
    if (!version) return;
    const ing = ingredients[0];
    if (!ing) return toast.error("Add ingredients first");
    setDraftItems([
      ...draftItems,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        version_id: version.id,
        position: draftItems.length + 1,
        ingredient_id: ing.id,
        prep_id: null,
        qty: 0,
        unit_id: ing.base_unit_id,
        wastage_pct: 0,
        notes: null,
        is_veg_slot: false,
      },
    ]);
  }
  async function patchItem(id: string, patch: Partial<RecipeItem>) {
    setDraftItems(
      draftItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }
  async function delItem(id: string) {
    setDraftItems(
      draftItems
        .filter((it) => it.id !== id)
        .map((it, index) => ({ ...it, position: index + 1 })),
    );
  }

  async function saveRecipe() {
    if (!version || !draftVersion) return;
    setSaving(true);
    try {
      const { error: versionError } = await api
        .get("/foodcost/fc-recipe-versions")
        .then((r) => r.data);
      if (versionError) throw versionError;

      const persistedItems = draftItems.filter(
        (item) => !item.id.startsWith("draft-"),
      );
      const newItems = draftItems.filter((item) =>
        item.id.startsWith("draft-"),
      );
      const originalItems = new Map(items.map((item) => [item.id, item]));

      for (const item of persistedItems) {
        const original = originalItems.get(item.id);
        if (!original) continue;
        const patch = {
          ingredient_id: item.ingredient_id,
          prep_id: item.prep_id,
          qty: item.qty,
          unit_id: item.unit_id,
          position: item.position,
          notes: item.notes ?? null,
          is_veg_slot: item.is_veg_slot ?? false,
        };
        const previousPatch = {
          ingredient_id: original.ingredient_id,
          prep_id: original.prep_id,
          qty: original.qty,
          unit_id: original.unit_id,
          position: original.position,
          notes: original.notes ?? null,
          is_veg_slot: original.is_veg_slot ?? false,
        };
        if (JSON.stringify(patch) === JSON.stringify(previousPatch)) continue;
        const { error } = await api
          .patch(`/foodcost/recipe-items/${item.id}`, patch)
          .then((r) => r.data);
        if (error) throw error;
      }

      const removedIds = items
        .filter(
          (item) =>
            !persistedItems.some((draftItem) => draftItem.id === item.id),
        )
        .map((item) => item.id);
      if (removedIds.length > 0) {
        const { error } = await api
          .delete(`/foodcost/recipe-items`, { params: { ids: removedIds } })
          .then((r) => r.data);
        if (error) throw error;
      }

      if (newItems.length > 0) {
        const payload = newItems.map((item) => ({
          version_id: version.id,
          position: item.position,
          ingredient_id: item.ingredient_id,
          prep_id: item.prep_id,
          qty: item.qty,
          unit_id: item.unit_id,
          notes: item.notes ?? null,
          is_veg_slot: item.is_veg_slot ?? false,
        }));
        const { error } = await api
          .post("/foodcost/recipe-items", payload)
          .then((r) => r.data);
        if (error) throw error;
      }

      toast.success("Recipe saved");
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!recipe || !version || !product)
    return <p className="text-muted-foreground">Loading recipe…</p>;

  const ccy = version.currency;
  const backTo = ccy === "usd" ? "/foodcost/us" : "/foodcost/in";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to={backTo}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Recipes
        </Link>
        <span className="text-xs text-muted-foreground">
          v{version.version_no}
        </span>
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {ccy === "inr" ? "🇮🇳 INR" : "🇺🇸 USD"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-surface-elevated">
          <div className="border-b border-border px-4 py-2">
            <h2 className="font-display font-semibold">{product.name}</h2>
            <p className="text-xs text-muted-foreground">
              {brand?.name} · {category?.name} · {product.code}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Kind</th>
                <th className="px-3 py-2 text-left">Ingredient / Pre-Prep</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Unit</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Line cost</th>
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
                    No lines. Add the first below.
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
                      <td className="px-3 py-1.5 text-xs uppercase text-accent">
                        Veg slot
                      </td>
                      <td className="px-3 py-1.5 italic text-muted-foreground">
                        [Selected on each product]
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
                      <td className="px-3 py-1.5 text-right text-xs italic text-muted-foreground">
                        —
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs italic text-muted-foreground">
                        + veg
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
                }
                let price = 0;
                let baseCode = "";
                let label: React.ReactNode = "—";
                if (it.prep_id) {
                  const prep = preps.find((p) => p.id === it.prep_id);
                  const base = units.find((x) => x.id === prep?.base_unit_id);
                  const c = prepCosts[it.prep_id];
                  price = Number((ccy === "inr" ? c?.inr : c?.usd) ?? 0);
                  baseCode = base?.code ?? "";
                  label = prep?.name ?? "—";
                } else {
                  const ing = ingredients.find(
                    (i) => i.id === it.ingredient_id,
                  );
                  const base = units.find((x) => x.id === ing?.base_unit_id);
                  price =
                    ccy === "inr"
                      ? Number(ing?.price_inr ?? 0)
                      : Number(ing?.price_usd ?? 0);
                  baseCode = base?.code ?? "";
                  label = ing?.name ?? "—";
                }
                const qtyInBase =
                  u && baseCode
                    ? toBase(Number(it.qty), u.code) / toBase(1, baseCode)
                    : 0;
                const line = qtyInBase * price;
                const kind: "ingredient" | "prep" = it.prep_id
                  ? "prep"
                  : "ingredient";
                return (
                  <tr
                    key={it.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-1.5">
                      <Select
                        value={kind}
                        onValueChange={(v) => {
                          if (v === "prep") {
                            const p = preps[0];
                            if (!p)
                              return toast.error(
                                "Create pre-preps in this region first",
                              );
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
                          <SelectItem value="ingredient">Ingredient</SelectItem>
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
                                {p.name}{" "}
                                <span className="text-xs text-muted-foreground">
                                  · {p.code}
                                </span>
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
                                {i.name}{" "}
                                <span className="text-xs text-muted-foreground">
                                  ·{" "}
                                  {
                                    INGREDIENT_CATEGORIES.find(
                                      (c) => c.value === i.category,
                                    )?.label
                                  }
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <div className="text-[10px] text-muted-foreground">
                        {label === "—" ? "" : ""}
                      </div>
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
                        onValueChange={(v) => patchItem(it.id, { unit_id: v })}
                        disabled={!editable}
                      >
                        <SelectTrigger className="h-8 w-24">
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
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs">
                      {fmt(price, ccy, 4)}
                      {baseCode && (
                        <span className="text-muted-foreground">
                          {" "}
                          /{baseCode}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {fmt(line, ccy)}
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
          </table>
          {editable && (
            <div className="border-t border-border p-3 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" />
                Add ingredient
              </Button>
              <RecipeItemsBulk
                versionId={version?.id}
                ingredients={ingredients}
                preps={preps}
                units={units}
                existingCount={draftItems.length}
                existingItems={draftItems}
                onDone={async () => {
                  if (!version) return;
                  const { data: it } = await api.get("/foodcost/recipe-items", {
                    params: { country: country ?? undefined },
                  });
                  const orderedItems = ((it ?? []) as RecipeItem[]).sort(
                    (a, b) => a.position - b.position,
                  );
                  setItems(orderedItems);
                  setDraftItems(orderedItems);
                }}
              />
              <Button
                size="sm"
                onClick={saveRecipe}
                disabled={!hasUnsavedChanges || saving}
              >
                <Save className="mr-1 h-3 w-3" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <h3 className="text-sm font-semibold">
              Cost Summary ({ccy.toUpperCase()})
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              <Row k="Recipe cost" v={fmt(cost, ccy)} />

              <div className="border-t border-border/40 pt-2 space-y-1">
                <Row k="FC" v={fmt(cost, ccy)} />
                <Row k="PTR Margin" v={fmt(ptrMargin, ccy)} />
                <Row k="PPP" v={fmt(ppp, ccy)} accent />
                <Row k="Shero Margin" v={fmt(sheroMargin, ccy)} />
                <Row k="MRP" v={fmt(mrp, ccy)} accent />
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
              Fixed formula for all brands: PTR Margin = FC × 2 · PPP = FC + PTR
              Margin · Shero Margin = FC × 1.6 · MRP = PPP + Shero Margin.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <h3 className="text-sm font-semibold">Notes</h3>
            <Textarea
              className="mt-2"
              placeholder="Optional change summary…"
              value={draftVersion?.change_summary ?? ""}
              onChange={(e) =>
                setDraftVersion(
                  draftVersion
                    ? { ...draftVersion, change_summary: e.target.value }
                    : draftVersion,
                )
              }
              disabled={!editable}
            />
            {editable && (
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={saveRecipe}
                  disabled={!hasUnsavedChanges || saving}
                >
                  <Save className="mr-1 h-3 w-3" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={`tabular-nums ${accent ? "font-display text-lg font-bold" : "font-medium"}`}
      >
        {v}
      </span>
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: FcPricingMode;
  onChange: (m: FcPricingMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border text-[10px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("multiplier")}
        className={`px-2 py-0.5 ${value === "multiplier" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
      >
        × Multiplier
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("flat")}
        className={`px-2 py-0.5 ${value === "flat" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
      >
        + Flat
      </button>
    </div>
  );
}

function MultiplierPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {MULTIPLIER_PRESETS.map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m)}
          className={`rounded border px-2 py-0.5 text-xs ${value === m ? "border-accent bg-accent/10" : "border-border"}`}
        >
          {m}×
        </button>
      ))}
      <Input
        type="number"
        step="0.01"
        className="h-6 w-20 text-xs"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
}

function FlatInput({
  ccy,
  value,
  onChange,
  disabled,
}: {
  ccy: "inr" | "usd";
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const sym = ccy === "inr" ? "₹" : "$";
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{sym}</span>
      <Input
        type="number"
        step="0.01"
        className="h-7 w-28 text-xs"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        placeholder="Flat margin"
      />
      <span className="text-[10px] text-muted-foreground">added on top</span>
    </div>
  );
}

type RecipeItemBulkRow = {
  kind?: string;
  name: string;
  qty: number;
  unit_code: string;
};
function RecipeItemsBulk({
  versionId,
  ingredients,
  preps,
  units,
  existingCount,
  existingItems,
  onDone,
}: {
  versionId: string | undefined;
  ingredients: Ingredient[];
  preps: Prep[];
  units: Unit[];
  existingCount: number;
  existingItems: RecipeItem[];
  onDone: () => void;
}) {
  const stripParen = (s: string) =>
    s
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const ingByName = new Map<string, Ingredient>();
  ingredients.forEach((i) => {
    ingByName.set(i.name.toLowerCase(), i);
    ingByName.set(stripParen(i.name), i);
  });
  const prepByName = new Map<string, Prep>();
  preps.forEach((p) => {
    prepByName.set(p.name.toLowerCase(), p);
    prepByName.set(stripParen(p.name), p);
    if (p.code) prepByName.set(p.code.toLowerCase(), p);
    const m = p.name.match(/\(([^)]+)\)/);
    if (m) prepByName.set(m[1].trim().toLowerCase(), p);
  });
  const unitByCode = new Map(units.map((u) => [u.code.toLowerCase(), u]));
  const lookupName = (raw: string, kind: "ingredient" | "prep") => {
    const s = String(raw ?? "")
      .trim()
      .toLowerCase();
    const map = kind === "prep" ? prepByName : ingByName;
    return (map.get(s) ?? map.get(stripParen(s))) || null;
  };
  const normKind = (v: unknown): "ingredient" | "prep" => {
    const s = String(v ?? "")
      .trim()
      .toLowerCase();
    if (["prep", "pre-prep", "preprep", "pre prep", "p"].includes(s))
      return "prep";
    return "ingredient";
  };
  const cols: BulkColumn<RecipeItemBulkRow>[] = [
    {
      key: "kind",
      label: "Kind",
      required: false,
      example: "ingredient",
      transform: (v) => (v == null || v === "" ? "ingredient" : normKind(v)),
      validate: (v) =>
        ["ingredient", "prep"].includes(String(v))
          ? null
          : "use 'ingredient' or 'prep'",
    },
    {
      key: "name",
      label: "Ingredient or Pre-Prep name",
      required: true,
      example: ingredients[0]?.name ?? "Tomato",
      validate: (v, row) => {
        const k = normKind(row.kind);
        return lookupName(String(v), k)
          ? null
          : k === "prep"
            ? "pre-prep not found"
            : "ingredient not found";
      },
    },
    {
      key: "qty",
      label: "Quantity",
      required: true,
      example: 100,
      validate: (v) => (isNaN(Number(v)) ? "must be a number" : null),
    },
    {
      key: "unit_code",
      label: "Unit code",
      required: true,
      example: "g",
      validate: (v) =>
        unitByCode.has(String(v).toLowerCase()) ? null : "unknown unit code",
    },
  ];
  return (
    <BulkUpload
      entity="recipe-items"
      triggerLabel="Bulk add ingredients"
      columns={cols}
      hint="Adds ingredient and pre-prep lines to the current draft version. Set Kind to 'ingredient' (default) or 'prep'. Pre-preps can be referenced by full name, by name without the parenthetical code, or by code alone (e.g. 'Tamarind Pulp', 'Tamarind Pulp (TMP)', or 'TMP')."
      onCommit={async (rows) => {
        if (!versionId) throw new Error("No draft version");
        const seen = new Set<string>();
        for (const it of existingItems) {
          const key = `${it.prep_id ? "p:" + it.prep_id : "i:" + it.ingredient_id}|${Number(it.qty)}|${it.unit_id}`;
          seen.add(key);
        }
        const payload: Array<{
          version_id: string;
          position: number;
          ingredient_id: string | null;
          prep_id: string | null;
          qty: number;
          unit_id: string;
        }> = [];
        let skipped = 0;
        for (const r of rows) {
          const k = normKind(r.kind);
          const isPrep = k === "prep";
          const match = lookupName(String(r.name), k);
          if (!match)
            throw new Error(
              `${isPrep ? "Pre-prep" : "Ingredient"} not found: ${r.name}`,
            );
          const unitId = unitByCode.get(String(r.unit_code).toLowerCase())!.id;
          const targetKey = isPrep
            ? "p:" + (match as Prep).id
            : "i:" + (match as Ingredient).id;
          const key = `${targetKey}|${Number(r.qty)}|${unitId}`;
          if (seen.has(key)) {
            skipped++;
            continue;
          }
          seen.add(key);
          payload.push({
            version_id: versionId,
            position: existingCount + payload.length + 1,
            ingredient_id: isPrep ? null : (match as Ingredient).id,
            prep_id: isPrep ? (match as Prep).id : null,
            qty: Number(r.qty),
            unit_id: unitId,
          });
        }
        if (payload.length) {
          const { error } = await api
            .post("/foodcost/recipe-items", payload)
            .then((r) => r.data);
          if (error) throw new Error(error.message);
        }
        return { inserted: payload.length, skipped };
      }}
      onDone={onDone}
    />
  );
}
