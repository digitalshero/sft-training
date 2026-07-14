import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import { type Product, type Recipe, type FcCurrency } from "@/lib/foodcost/types";

type Row = Recipe & { product: Product | null; cost: number; currency: FcCurrency };

export function RecipesList({ currency }: { currency: FcCurrency }) {
  const { isEditor } = useRoles();
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");

  const symbol = currency === "inr" ? "₹" : "$";
  const label = currency === "inr" ? "India (INR)" : "USA (USD)";

  async function load() {
    const [r, p] = await Promise.all([
      api.get("/foodcost/recipes", { params: { country: country ?? undefined } }),
      api.get("/foodcost/products", { params: { country: country ?? undefined } }),
    ]);
    const recipes = (r.data ?? []) as Recipe[];
    const allProducts = (p.data ?? []) as Product[];
    const vids = recipes.map((rc) => rc.current_version_id).filter(Boolean) as string[];
    const versions = vids.length
      ? await api
          .get("/foodcost/recipe-versions", { params: { country: country ?? undefined } })
          .in("id", vids)
      : { data: [] };
    const costs = vids.length
      ? await api.get("/foodcost/recipe-versions").in("version_id", vids)
      : { data: [] };
    const vMap = new Map(
      ((versions.data ?? []) as { id: string; currency: FcCurrency }[]).map((v) => [v.id, v]),
    );
    const cMap = new Map(
      ((costs.data ?? []) as { version_id: string; cost_inr: number; cost_usd: number }[]).map(
        (c) => [c.version_id, c],
      ),
    );

    const mapped: Row[] = recipes
      .filter((rc) => {
        const v = rc.current_version_id ? vMap.get(rc.current_version_id) : null;
        return v?.currency === currency;
      })
      .map((rc) => {
        const c = rc.current_version_id ? cMap.get(rc.current_version_id) : null;
        return {
          ...rc,
          product: allProducts.find((pr) => pr.id === rc.product_id) ?? null,
          cost: currency === "inr" ? Number(c?.cost_inr ?? 0) : Number(c?.cost_usd ?? 0),
          currency,
        };
      });
    setRows(mapped);
    setProducts(allProducts);
  }
  useEffect(() => {
    load();
  }, [currency]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (q && !(r.product?.name ?? "").toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, q],
  );

  // Products that have no recipe yet IN THIS CURRENCY
  const productsAvailable = products.filter((p) => !rows.some((r) => r.product_id === p.id));

  async function startRecipe(productId: string) {
    const existing = await api
      .get("/foodcost/recipes", { params: { country: country ?? undefined } })
      .maybeSingle();
    if (existing.error) return toast.error(existing.error.message);
    if (existing.data) {
      window.location.href = `/foodcost/recipes/${existing.data.id}`;
      return;
    }
    const rec = await api
      .post("/foodcost/recipes", { product_id: productId, status: "draft" })
      .then((r) => r.data)
      .catch(() => null);
    const error = null.then((r) => r.data);
    if (error || !rec) return toast.error(error?.message ?? "Failed");
    const ver = await api
      .post("/foodcost/recipe-versions", {
        recipe_id: rec.id,
        version_no: 1,
        currency,
        status: "draft",
      })
      .then((r) => r.data)
      .catch(() => null);
    const error = null.then((r) => r.data);
    if (vErr || !ver) return toast.error(vErr?.message ?? "Failed");
    await api
      .patch(`/foodcost/recipes/${rec.id}`, { current_version_id: ver.id })
      .then((r) => r.data);
    window.location.href = `/foodcost/recipes/${rec.id}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-display text-lg font-semibold">Recipes — {label}</h2>
          <p className="text-xs text-muted-foreground">
            All recipes costed in {currency.toUpperCase()}. Same product can have a separate recipe
            for the other country.
          </p>
        </div>
        <Input
          placeholder="Search product…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        {isEditor && productsAvailable.length > 0 && (
          <Select onValueChange={startRecipe}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={`+ Start ${currency.toUpperCase()} recipe for product…`} />
            </SelectTrigger>
            <SelectContent>
              {productsAvailable.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-surface-elevated">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Product</th>
              <th className="px-4 py-2 text-right">Cost ({currency.toUpperCase()})</th>
              <th className="px-4 py-2 text-left">Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No {currency.toUpperCase()} recipes yet.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2 font-medium">{r.product?.name ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {symbol}
                  {r.cost.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {new Date(r.updated_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    to="/foodcost/recipes/$recipeId"
                    params={{ recipeId: r.id }}
                    className="text-xs text-accent hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
