import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import { Plus } from "lucide-react";
import { toBase, fmt, type FcCurrency } from "@/lib/foodcost/types";
import { useFoodcostCountry, COUNTRY_LABEL, countryCurrency } from "@/lib/foodcost/country";
import { computePricing } from "@/lib/foodcost/pricing";

type PL = {
  id: string;
  name: string;
  currency: FcCurrency;
  status: string;
  generated_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  notes: string | null;
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/15 text-blue-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export function PriceListsPage() {
  const { isEditor } = useRoles();
  const nav = useNavigate();
  const country = useFoodcostCountry();
  const lockedCurrency = country ? countryCurrency(country) : null;
  const [rows, setRows] = useState<PL[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<FcCurrency>(lockedCurrency ?? "inr");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (lockedCurrency) setCurrency(lockedCurrency);
  }, [lockedCurrency]);

  async function load() {
    let q = api.get("/foodcost/price-lists", { params: { country: country ?? undefined } });
    if (lockedCurrency) q = q.eq("currency", lockedCurrency);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setRows((data ?? []) as PL[]);
  }
  useEffect(() => {
    load();
  }, [lockedCurrency]);

  async function generate() {
    if (!name.trim()) return toast.error("Give the price list a name");
    setBusy(true);
    try {
      // auth.getUser() replaced - userId comes from JWT; use useAuth() hook in component or pass as prop
      // user id from JWT - injected by backend from Bearer token
      const nowIso = new Date().toISOString();
      const { data: pl, error: plErr } = await api
        .get("/foodcost/price-lists")
        .insert({
          name: name.trim(),
          currency,
          generated_by: user?.id,
          notes: null,
          status: "approved",
          approved_by: user?.id,
          approved_at: nowIso,
        })
        .select()
        .single();
      if (plErr || !pl) throw plErr ?? new Error("Failed to create");

      const activeField = currency === "inr" ? "active_in" : "active_us";

      // 2. Snapshot all active ingredients (country-scoped)
      const { data: ings } = await api
        .get("/foodcost/ingredients")
        .select("id, name, category, price_inr, price_usd, base_unit_id")
        .eq("status", "active")
        .eq(activeField, true)
        .order("name");
      const { data: units } = await api.get("/foodcost/units", {
        params: { country: country ?? undefined },
      });
      const unitMap = new Map((units ?? []).map((u) => [u.id, u.code]));
      const ingredientItems = (ings ?? []).map((i, idx) => ({
        price_list_id: pl.id,
        kind: "ingredient" as const,
        ref_id: i.id,
        name: i.name,
        meta: { category: i.category },
        unit_code: unitMap.get(i.base_unit_id) ?? "",
        unit_price: currency === "inr" ? Number(i.price_inr) : Number(i.price_usd),
        position: idx,
      }));

      // 3. Snapshot all active products with FC / PPP / MRP based on category mode
      const { data: products } = await api
        .get("/foodcost/products")
        .select("id, name, code, brand_id, category_id")
        .eq("status", "active")
        .eq(activeField, true)
        .order("name");

      const { data: cats } = await api.get("/foodcost/categories");
      const catMap = new Map((cats ?? []).map((c) => [c.id, c as Record<string, unknown>]));

      const { data: pcs } = await api
        .get("/foodcost/packing-containers")
        .select("id, price_inr, price_usd");
      const pcMap = new Map(
        (pcs ?? []).map((p) => [p.id, p as { id: string; price_inr: number; price_usd: number }]),
      );

      // Batch product cost via RPC
      const costs = await Promise.all(
        (products ?? []).map((p) =>
          api.post("/foodcost/product-cost", { _product_id: p.id, _currency: currency }),
        ),
      );

      const productItems = (products ?? [])
        .map((p, idx) => {
          // Skip products whose category is inactive (or missing)
          const catStatus = (catMap.get(p.category_id) as { status?: string } | undefined)?.status;
          if (catStatus && catStatus !== "active") return null;
          const cost = Number(costs[idx]?.data ?? 0);
          const cat = catMap.get(p.category_id) as
            | {
                name: string;
                ppp_mode: string;
                mrp_mode: string;
                ppp_multiplier_inr: number;
                mrp_multiplier_inr: number;
                ppp_multiplier_usd: number;
                mrp_multiplier_usd: number;
                ppp_flat_inr: number;
                mrp_flat_inr: number;
                ppp_flat_usd: number;
                mrp_flat_usd: number;
                packing_container_id: string | null;
              }
            | undefined;
          let ppp: number | null = null;
          let mrp: number | null = null;
          let packing = 0;
          let total: number | null = null;
          let pppLabel = "FC × 3",
            mrpLabel = "FC × 4.6";
          if (cat) {
            const container = cat.packing_container_id
              ? pcMap.get(cat.packing_container_id)
              : undefined;
            packing = container
              ? currency === "inr"
                ? Number(container.price_inr)
                : Number(container.price_usd)
              : 0;
            const p = computePricing(cost, packing);
            ppp = p.ppp;
            mrp = p.mrp;
            total = p.ppp + p.packing;
            pppLabel = "FC + (FC × 2)";
            mrpLabel = "PPP + (FC × 1.6)";
          }
          return {
            price_list_id: pl.id,
            kind: "recipe" as const,
            ref_id: p.id,
            name: p.name,
            meta: {
              product_code: p.code,
              category: cat?.name,
              ppp_rule: pppLabel,
              mrp_rule: mrpLabel,
            },
            unit_code: "portion",
            unit_price: cost,
            ppp_price: ppp,
            packing_price: packing,
            total_price: total,
            mrp_price: mrp,
            position: idx,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const all = [...ingredientItems, ...productItems];
      if (all.length) {
        const { error: itemsErr } = await api
          .post("/foodcost/price-list-items", all)
          .then((r) => r.data);
        if (itemsErr) throw itemsErr;
      }

      await api
        .post("/foodcost/price-list-log", {
          price_list_id: pl.id,
          from_status: null,
          to_status: "approved",
          actor_id: user?.id,
          role: "editor",
          comment: `Generated & published with ${ingredientItems.length} ingredients + ${productItems.length} products`,
        })
        .then((r) => r.data);

      toast.success("Price list generated");
      setOpen(false);
      setName("");
      if (country === "us") nav({ to: "/foodcost/us/price-lists/$id", params: { id: pl.id } });
      else nav({ to: "/foodcost/in/price-lists/$id", params: { id: pl.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-display text-lg font-semibold">
            Price Lists{" "}
            {country && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — {COUNTRY_LABEL[country]} ({lockedCurrency?.toUpperCase()})
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            Generate a snapshot of all ingredient prices and recipe costs. Snapshots are published
            immediately.
          </p>
        </div>
        {isEditor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Generate price list
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate new price list</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Q3 2026 Price List"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Currency{" "}
                    {lockedCurrency && (
                      <span className="ml-1 text-[10px]">
                        (locked to {COUNTRY_LABEL[country!]})
                      </span>
                    )}
                  </Label>
                  <Select
                    value={currency}
                    onValueChange={(v) => setCurrency(v as FcCurrency)}
                    disabled={!!lockedCurrency}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inr">INR</SelectItem>
                      <SelectItem value="usd">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  A snapshot will be taken of every active ingredient (price + base unit) and every
                  recipe's current cost, PPP and MRP in {currency.toUpperCase()}.
                </p>
                <div className="flex justify-end">
                  <Button onClick={generate} disabled={busy}>
                    {busy ? "Generating…" : "Generate"}
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
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Currency</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Generated</th>
              <th className="px-4 py-2 text-left">Approved</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No price lists yet. Generate the first.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2 uppercase text-xs">{r.currency}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {new Date(r.generated_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {r.approved_at ? new Date(r.approved_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {country === "us" ? (
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline"
                      onClick={() =>
                        nav({ to: "/foodcost/us/price-lists/$id", params: { id: r.id } })
                      }
                    >
                      Open →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline"
                      onClick={() =>
                        nav({ to: "/foodcost/in/price-lists/$id", params: { id: r.id } })
                      }
                    >
                      Open →
                    </button>
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

void fmt;
void toBase;
