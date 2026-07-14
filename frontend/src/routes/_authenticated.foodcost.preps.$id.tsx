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
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import type {
  Prep,
  Unit,
  Ingredient,
  Recipe,
  RecipeVersion,
  RecipeItem,
  FcCurrency,
  FcVersionStatus,
} from "@/lib/foodcost/types";
import {
  PREP_TYPES,
  fmt,
  toBase,
  RECIPE_STATUS_TONE,
} from "@/lib/foodcost/types";
import { useFoodcostCountry } from "@/lib/foodcost/country";

export const Route = createFileRoute("/_authenticated/foodcost/preps/$id")({
  component: PrepEditorPage,
});

function getImplicitYieldQty(unitCode: string | null | undefined) {
  return unitCode === "g" || unitCode === "ml" ? 1000 : 1;
}

function PrepEditorPage() {
  const { id } = Route.useParams();
  const { isEditor } = useRoles();
  const country = useFoodcostCountry();
  const [prep, setPrep] = useState<Prep | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [version, setVersion] = useState<RecipeVersion | null>(null);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [preps, setPreps] = useState<Prep[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [prepCosts, setPrepCosts] = useState<
    Record<string, { inr: number | null; usd: number | null }>
  >({});
  const [ccyTab, setCcyTab] = useState<FcCurrency>("inr");
  const [draftVersion, setDraftVersion] = useState<RecipeVersion | null>(null);
  const [draftItems, setDraftItems] = useState<RecipeItem[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [pRes, iRes, uRes, allPreps, costs] = await Promise.all([
      api.get(`/foodcost/preps/${id}`, {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/ingredients", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/units", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/preps", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/preps"),
    ]);
    if (!pRes.data) return;
    setPrep(pRes.data as Prep);
    setIngredients((iRes.data ?? []) as Ingredient[]);
    setUnits((uRes.data ?? []) as Unit[]);
    setPreps((allPreps.data ?? []) as Prep[]);
    const cmap: Record<string, { inr: number | null; usd: number | null }> = {};
    for (const r of (costs.data ?? []) as Array<{
      prep_id: string;
      unit_cost_inr: number | null;
      unit_cost_usd: number | null;
    }>) {
      cmap[r.prep_id] = { inr: r.unit_cost_inr, usd: r.unit_cost_usd };
    }
    setPrepCosts(cmap);
    await loadRecipe(
      id,
      ccyTab,
      pRes.data as Prep,
      (uRes.data ?? []) as Unit[],
    );
  }

  async function loadRecipe(
    prepId: string,
    ccy: FcCurrency,
    prepRecord?: Prep | null,
    unitRows: Unit[] = units,
  ) {
    // Find recipe + version for this prep in this currency.
    const recipes = await api
      .get("/foodcost/recipes", { params: { prep_id: prepId } })
      .then((r) => r.data)
      .catch(() => []);
    const { data: recipes2 } = { data: recipes };
    const r = (recipes2?.data ?? recipes ?? [])[0] as Recipe | undefined;
    if (!r) {
      setRecipe(null);
      setVersion(null);
      setDraftVersion(null);
      setItems([]);
      setDraftItems([]);
      return;
    }
    setRecipe(r);

    const vRows = await api
      .get("/foodcost/recipe-versions", {
        params: { recipe_id: r.id, currency: ccy },
      })
      .then((r) => r.data)
      .catch(() => []);
    let v = (Array.isArray(vRows) ? vRows : [])[0] as RecipeVersion | undefined;
    if (!v) {
      setVersion(null);
      setDraftVersion(null);
      setItems([]);
      setDraftItems([]);
      return;
    }

    const activePrep = prepRecord ?? prep;
    const defaultYieldUnitId =
      activePrep?.default_yield_unit_id ?? activePrep?.base_unit_id ?? null;
    const yieldUnitId = v.yield_unit_id ?? defaultYieldUnitId;
    const yieldUnitCode = unitRows.find((u) => u.id === yieldUnitId)?.code;
    const needsLegacyYieldRepair =
      !!activePrep &&
      activePrep.default_yield_qty == null &&
      v.status === "draft" &&
      v.yield_qty === 1 &&
      yieldUnitId != null &&
      yieldUnitId === defaultYieldUnitId &&
      (yieldUnitCode === "g" || yieldUnitCode === "ml");

    if (needsLegacyYieldRepair) {
      const repairedYieldQty = getImplicitYieldQty(yieldUnitCode);
      const { error } = await api
        .get("/foodcost/fc-recipe-versions")
        .then((r) => r.data);
      if (!error) {
        v = { ...v, yield_qty: repairedYieldQty };
      }
    }

    setVersion(v);
    setDraftVersion(v);
    const { data: it } = await api.get("/foodcost/recipe-items", {
      params: { country: country ?? undefined },
    });
    setItems(
      ((it ?? []) as RecipeItem[]).sort((a, b) => a.position - b.position),
    );
    setDraftItems(
      ((it ?? []) as RecipeItem[]).sort((a, b) => a.position - b.position),
    );
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);
  useEffect(() => {
    if (prep && units.length > 0)
      loadRecipe(
        id,
        ccyTab,
        prep,
        units,
      ); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [ccyTab, prep, units]);

  const editable = isEditor;
  const hasUnsavedChanges =
    JSON.stringify(draftVersion) !== JSON.stringify(version) ||
    JSON.stringify(draftItems) !== JSON.stringify(items);

  async function ensureDraft() {
    if (!prep) return null;
    let r = recipe;
    if (!r) {
      const ins = await api
        .post("/foodcost/recipes", { prep_id: prep.id, status: "approved" })
        .then((r) => r.data);
      if (ins.error) {
        toast.error(ins.error.message);
        return null;
      }
      r = ins.data as Recipe;
      setRecipe(r);
    }
    if (version && version.currency === ccyTab) return version;
    // create next version no.
    const { data: maxV } = await api.get("/foodcost/recipe-versions", {
      params: { country: country ?? undefined },
    });
    const nextNo = ((maxV?.[0]?.version_no as number | undefined) ?? 0) + 1;
    const yieldUnitId = prep.default_yield_unit_id ?? prep.base_unit_id;
    const yieldUnitCode = units.find((u) => u.id === yieldUnitId)?.code;
    const nowIso = new Date().toISOString();
    const vIns = await api
      .post("/foodcost/recipe-versions", {
        recipe_id: r.id,
        version_no: nextNo,
        currency: ccyTab,
        status: "approved",
        approved_at: nowIso,
        yield_qty: prep.default_yield_qty ?? getImplicitYieldQty(yieldUnitCode),
        yield_unit_id: yieldUnitId,
        wastage_pct: prep.default_wastage_pct ?? 0,
      })
      .then((r) => r.data);
    if (vIns.error) {
      toast.error(vIns.error.message);
      return null;
    }
    const v = vIns.data as RecipeVersion;
    await api
      .patch(`/foodcost/recipes/${r.id}`, {
        current_version_id: v.id,
        status: "approved",
      })
      .then((r) => r.data);
    setVersion(v);
    setDraftVersion(v);
    setItems([]);
    setDraftItems([]);
    return v;
  }

  async function addItem(kind: "ingredient" | "prep") {
    const v = await ensureDraft();
    if (!v) return;
    if (kind === "ingredient") {
      const ing = ingredients[0];
      if (!ing) return toast.error("No ingredients available");
      setDraftItems([
        ...draftItems,
        {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          version_id: v.id,
          position: draftItems.length + 1,
          ingredient_id: ing.id,
          prep_id: null,
          qty: 0,
          unit_id: ing.base_unit_id,
          wastage_pct: 0,
          notes: null,
        } as RecipeItem,
      ]);
    } else {
      const p = preps[0];
      if (!p) return toast.error("No other pre-preps available");
      setDraftItems([
        ...draftItems,
        {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          version_id: v.id,
          position: draftItems.length + 1,
          ingredient_id: null,
          prep_id: p.id,
          qty: 0,
          unit_id: p.base_unit_id,
          wastage_pct: 0,
          notes: null,
        } as RecipeItem,
      ]);
    }
  }

  async function patchItem(itemId: string, patch: Partial<RecipeItem>) {
    setDraftItems(
      draftItems.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    );
  }

  async function delItem(itemId: string) {
    setDraftItems(
      draftItems
        .filter((it) => it.id !== itemId)
        .map((it, index) => ({ ...it, position: index + 1 })),
    );
  }

  async function patchVersion(patch: Partial<RecipeVersion>) {
    if (!draftVersion) return;
    setDraftVersion({ ...draftVersion, ...patch });
  }

  async function savePrepRecipe() {
    if (!version || !draftVersion) return;
    setSaving(true);
    try {
      const versionPatch = {
        yield_qty: draftVersion.yield_qty,
        yield_unit_id: draftVersion.yield_unit_id,
        wastage_pct: draftVersion.wastage_pct,
      };
      const { error: versionError } = await api
        .patch(`/foodcost/recipe-versions/${version.id}`, versionPatch)
        .then((r) => r.data);
      if (versionError) throw versionError;

      const existingDraftItems = draftItems.filter(
        (it) => !it.id.startsWith("draft-"),
      );
      const newDraftItems = draftItems.filter((it) =>
        it.id.startsWith("draft-"),
      );
      const originalMap = new Map(items.map((it) => [it.id, it]));

      for (const item of existingDraftItems) {
        const original = originalMap.get(item.id);
        if (!original) continue;
        const patch = {
          ingredient_id: item.ingredient_id,
          prep_id: item.prep_id,
          qty: item.qty,
          unit_id: item.unit_id,
          wastage_pct: item.wastage_pct,
          position: item.position,
          notes: item.notes ?? null,
        };
        const previousPatch = {
          ingredient_id: original.ingredient_id,
          prep_id: original.prep_id,
          qty: original.qty,
          unit_id: original.unit_id,
          wastage_pct: original.wastage_pct,
          position: original.position,
          notes: original.notes ?? null,
        };
        if (JSON.stringify(patch) === JSON.stringify(previousPatch)) continue;
        const { error } = await api
          .patch(`/foodcost/recipe-items/${item.id}`, patch)
          .then((r) => r.data);
        if (error) throw error;
      }

      const removedIds = items
        .filter(
          (it) =>
            !existingDraftItems.some((draftItem) => draftItem.id === it.id),
        )
        .map((it) => it.id);
      if (removedIds.length > 0) {
        const { error } = await api
          .delete(`/foodcost/recipe-items`, { params: { ids: removedIds } })
          .then((r) => r.data);
        if (error) throw error;
      }

      if (newDraftItems.length > 0) {
        const payload = newDraftItems.map((item) => ({
          version_id: version.id,
          position: item.position,
          ingredient_id: item.ingredient_id,
          prep_id: item.prep_id,
          qty: item.qty,
          unit_id: item.unit_id,
          wastage_pct: item.wastage_pct,
          notes: item.notes ?? null,
        }));
        const { error } = await api
          .post("/foodcost/recipe-items", payload)
          .then((r) => r.data);
        if (error) throw error;
      }

      toast.success("Pre-prep saved");
      await loadRecipe(id, ccyTab, prep, units);
    } catch (error) {
      toast.error((error as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function newDraft() {
    setVersion(null); // forces ensureDraft to create a new one
    await ensureDraft();
    load();
  }

  // Compute live batch cost
  const lineCosts = useMemo(() => {
    if (!draftVersion)
      return [] as Array<{ id: string; lineCost: number; effective: number }>;
    return draftItems.map((it) => {
      const u = units.find((x) => x.id === it.unit_id);
      if (!u) return { id: it.id, lineCost: 0, effective: 0 };
      let unitPrice = 0;
      if (it.ingredient_id) {
        const ing = ingredients.find((i) => i.id === it.ingredient_id);
        if (!ing) return { id: it.id, lineCost: 0, effective: 0 };
        const baseU = units.find((x) => x.id === ing.base_unit_id);
        if (!baseU) return { id: it.id, lineCost: 0, effective: 0 };
        const qtyInBase =
          toBase(Number(it.qty), u.code) / toBase(1, baseU.code);
        const price =
          draftVersion.currency === "inr"
            ? Number(ing.price_inr)
            : Number(ing.price_usd);
        unitPrice = qtyInBase * price;
      } else if (it.prep_id) {
        const sub = preps.find((p) => p.id === it.prep_id);
        if (!sub) return { id: it.id, lineCost: 0, effective: 0 };
        const baseU = units.find((x) => x.id === sub.base_unit_id);
        if (!baseU) return { id: it.id, lineCost: 0, effective: 0 };
        const subCost =
          draftVersion.currency === "inr"
            ? prepCosts[sub.id]?.inr
            : prepCosts[sub.id]?.usd;
        if (subCost == null) return { id: it.id, lineCost: 0, effective: 0 };
        const qtyInBase =
          toBase(Number(it.qty), u.code) / toBase(1, baseU.code);
        unitPrice = qtyInBase * Number(subCost);
      }
      const lineCost = unitPrice;
      const effective = lineCost * (1 + Number(it.wastage_pct ?? 0) / 100);
      return { id: it.id, lineCost, effective };
    });
  }, [draftItems, draftVersion, ingredients, units, preps, prepCosts]);

  const batchCost = lineCosts.reduce((s, r) => s + r.effective, 0);
  const yieldUnit = units.find((u) => u.id === draftVersion?.yield_unit_id);
  const wastageDivisor = draftVersion
    ? 1 - Number(draftVersion.wastage_pct ?? 0) / 100
    : 1;
  // toBase() normalizes to kg / L / pcs, so costPerLarge is cost per kg (or L, or pcs).
  const yieldInLarge =
    draftVersion && yieldUnit
      ? toBase(Number(draftVersion.yield_qty ?? 0), yieldUnit.code) *
        wastageDivisor
      : 0;
  const baseUnit = units.find((u) => u.id === prep?.base_unit_id);
  const costPerLarge = yieldInLarge > 0 ? batchCost / yieldInLarge : null;
  // Cost expressed in the prep's declared base unit.
  const costPerBase =
    costPerLarge == null
      ? null
      : baseUnit?.code === "g" || baseUnit?.code === "ml"
        ? costPerLarge / 1000
        : costPerLarge;

  if (!prep) return <p className="text-muted-foreground">Loading…</p>;
  const ccy = ccyTab;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/foodcost"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Pre-Preps
        </Link>
        <span className="font-mono text-xs">{prep.code}</span>
        <h1 className="font-display text-xl font-bold">{prep.name}</h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {PREP_TYPES.find((t) => t.value === prep.type)?.label}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Currency:</span>
          <Select
            value={ccyTab}
            onValueChange={(v) => setCcyTab(v as FcCurrency)}
          >
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inr">🇮🇳 INR</SelectItem>
              <SelectItem value="usd">🇺🇸 USD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-surface-elevated">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div>
              <h2 className="font-display font-semibold">Recipe lines</h2>
              {version ? (
                <p className="text-xs text-muted-foreground">
                  v{version.version_no} ·{" "}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${RECIPE_STATUS_TONE[version.status === "superseded" ? "approved" : (version.status as never)] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {version.status}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No version yet for {ccy.toUpperCase()}.
                </p>
              )}
            </div>
            {isEditor && editable && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addItem("ingredient")}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Ingredient
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addItem("prep")}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Pre-prep
                </Button>
                <Button size="sm" onClick={savePrepRecipe} disabled={saving}>
                  <Save className="mr-1 h-3 w-3" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
            {isEditor && !version && (
              <Button size="sm" onClick={() => ensureDraft()}>
                Start {ccy.toUpperCase()} draft
              </Button>
            )}
            {isEditor && version && version.status !== "draft" && (
              <Button size="sm" variant="outline" onClick={newDraft}>
                New draft
              </Button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Kind</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Unit</th>
                <th className="px-3 py-2 text-right">Line cost</th>
                <th className="px-3 py-2 text-right">Wastage %</th>
                <th className="px-3 py-2 text-right">Effective</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draftItems.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No lines yet.
                  </td>
                </tr>
              )}
              {draftItems.map((it) => {
                const lc = lineCosts.find((l) => l.id === it.id);
                const isPrep = !!it.prep_id;
                return (
                  <tr
                    key={it.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-1.5 text-xs">
                      {isPrep ? "Pre-prep" : "Ingredient"}
                    </td>
                    <td className="px-3 py-1.5">
                      {isPrep ? (
                        <Select
                          value={it.prep_id ?? undefined}
                          onValueChange={(v) =>
                            patchItem(it.id, {
                              prep_id: v,
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
                                {p.code} · {p.name}
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
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {fmt(lc?.lineCost ?? 0, ccy)}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="number"
                        step="0.1"
                        className="h-8 w-20 text-right"
                        value={it.wastage_pct}
                        onChange={(e) =>
                          patchItem(it.id, {
                            wastage_pct: Number(e.target.value),
                          })
                        }
                        disabled={!editable}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {fmt(lc?.effective ?? 0, ccy)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {editable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => delItem(it.id)}
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

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <h3 className="font-display text-sm font-semibold">
              Batch & yield
            </h3>
            <div className="mt-3 grid gap-2">
              <Field label="Yield qty">
                <Input
                  type="number"
                  step="0.01"
                  value={draftVersion?.yield_qty ?? ""}
                  onChange={(e) =>
                    patchVersion({
                      yield_qty:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  disabled={!editable}
                />
              </Field>
              <Field label="Yield unit">
                <Select
                  value={draftVersion?.yield_unit_id ?? prep.base_unit_id}
                  onValueChange={(v) => patchVersion({ yield_unit_id: v })}
                  disabled={!editable}
                >
                  <SelectTrigger>
                    <SelectValue />
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
              <Field label="Batch wastage %">
                <Input
                  type="number"
                  step="0.1"
                  value={draftVersion?.wastage_pct ?? 0}
                  onChange={(e) =>
                    patchVersion({ wastage_pct: Number(e.target.value) })
                  }
                  disabled={!editable}
                />
              </Field>
            </div>
            {editable && (
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={savePrepRecipe} disabled={saving}>
                  <Save className="mr-1 h-3 w-3" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <h3 className="font-display text-sm font-semibold">Cost</h3>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total batch cost</dt>
                <dd className="tabular-nums">{fmt(batchCost, ccy)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Cost / {baseUnit?.code ?? "base unit"}
                </dt>
                <dd className="tabular-nums">
                  {costPerBase == null ? "—" : fmt(costPerBase, ccy, 4)}
                </dd>
              </div>
              {baseUnit?.code === "kg" && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cost / g</dt>
                  <dd className="tabular-nums">
                    {costPerBase == null
                      ? "—"
                      : fmt(costPerBase / 1000, ccy, 4)}
                  </dd>
                </div>
              )}
              {baseUnit?.code === "l" && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Cost / ml</dt>
                  <dd className="tabular-nums">
                    {costPerBase == null
                      ? "—"
                      : fmt(costPerBase / 1000, ccy, 4)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
