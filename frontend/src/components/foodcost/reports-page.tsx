import { useEffect, useState, type ReactNode } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { exportCSV, exportXLSX, exportPDF, type ExportColumn } from "@/lib/export";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

type Currency = "inr" | "usd";

type RecipeRow = {
  product_name: string;
  brand: string;
  category: string;
  status: string;
  currency: Currency;
  cost_inr: number;
  cost_usd: number;
  version_no: number;
  approved_at: string | null;
  approved_by_name: string | null;
};

type PriceRow = {
  name: string;
  currency: Currency;
  old_price: number;
  new_price: number;
  delta_pct: number;
  reason: string | null;
  changed_at: string;
};

export function FoodCostReportsPage() {
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [recRes, prodRes, brandRes, catRes, verRes, costRes, histRes, ingRes, profRes] =
      await Promise.all([
        api.get("/foodcost/recipes"),
        api.get("/foodcost/products"),
        api.get("/foodcost/brands"),
        api.get("/foodcost/categories"),
        api.get("/foodcost/recipe-versions"),
        api.get("/foodcost/recipe-versions"),
        api.get("/foodcost/ingredient-price-history", { params: { limit: 500 } }),
        api.get("/foodcost/ingredients"),
        api.get("/admin/users"),
      ]);

    const products = new Map<
      string,
      { id: string; name: string; brand_id: string; category_id: string }
    >(
      (prodRes.data ?? []).map(
        (p: { id: string; name: string; brand_id: string; category_id: string }) => [p.id, p],
      ),
    );
    const brands = new Map<string, { id: string; name: string }>(
      (brandRes.data ?? []).map((b: { id: string; name: string }) => [b.id, b]),
    );
    const cats = new Map<string, { id: string; name: string }>(
      (catRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c]),
    );
    const versions = new Map<
      string,
      {
        version_no: number;
        currency: Currency;
        approved_at: string | null;
        approved_by: string | null;
      }
    >(
      (verRes.data ?? []).map(
        (v: {
          id: string;
          version_no: number;
          currency: Currency;
          approved_at: string | null;
          approved_by: string | null;
        }) => [v.id, v],
      ),
    );
    const costs = new Map<string, { cost_inr: number; cost_usd: number }>(
      (costRes.data ?? [])
        .filter((c: { version_id?: string | null }) => c.version_id != null)
        .map((c: { version_id?: string | null; cost_inr: number; cost_usd: number }) => [
          c.version_id as string,
          { cost_inr: c.cost_inr, cost_usd: c.cost_usd },
        ]),
    );
    const ingredients = new Map<string, string>(
      (ingRes.data ?? []).map((i: { id: string; name: string }) => [i.id, i.name]),
    );
    const profiles = new Map<string, string | null>(
      (profRes.data ?? []).map((p: { id: string; display_name: string | null }) => [
        p.id,
        p.display_name,
      ]),
    );

    setRecipes(
      (
        (recRes.data ?? []) as Array<{
          id: string;
          product_id: string;
          current_version_id: string | null;
          status: string;
        }>
      ).map((recipe) => {
        const product = products.get(recipe.product_id);
        const version = recipe.current_version_id
          ? versions.get(recipe.current_version_id)
          : undefined;
        const cost = recipe.current_version_id ? costs.get(recipe.current_version_id) : undefined;

        return {
          product_name: product?.name ?? "—",
          brand: product ? (brands.get(product.brand_id)?.name ?? "—") : "—",
          category: product ? (cats.get(product.category_id)?.name ?? "—") : "—",
          status: recipe.status,
          currency: (version?.currency ?? "inr") as Currency,
          cost_inr: Number(cost?.cost_inr ?? 0),
          cost_usd: Number(cost?.cost_usd ?? 0),
          version_no: version?.version_no ?? 0,
          approved_at: version?.approved_at ?? null,
          approved_by_name: version?.approved_by
            ? (profiles.get(version.approved_by) ?? null)
            : null,
        };
      }),
    );

    setPrices(
      (
        (histRes.data ?? []) as Array<{
          ingredient_id: string;
          currency: Currency;
          old_price: number;
          new_price: number;
          reason: string | null;
          changed_at: string;
        }>
      ).map((history) => ({
        name: ingredients.get(history.ingredient_id) ?? "—",
        currency: history.currency,
        old_price: Number(history.old_price),
        new_price: Number(history.new_price),
        delta_pct: history.old_price
          ? ((Number(history.new_price) - Number(history.old_price)) / Number(history.old_price)) *
            100
          : 0,
        reason: history.reason,
        changed_at: history.changed_at,
      })),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">Reports</h2>
        <p className="text-xs text-muted-foreground">
          Separate report sets per market. Costs and price history are filtered by currency.
        </p>
      </div>
      <Tabs defaultValue="in">
        <TabsList>
          <TabsTrigger value="in">🇮🇳 India (INR)</TabsTrigger>
          <TabsTrigger value="us">🇺🇸 USA (USD)</TabsTrigger>
        </TabsList>
        <TabsContent value="in" className="mt-4">
          <CountryReports country="in" recipes={recipes} prices={prices} />
        </TabsContent>
        <TabsContent value="us" className="mt-4">
          <CountryReports country="us" recipes={recipes} prices={prices} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function latestApproved(rows: RecipeRow[]): { date: string | null; by: string | null } {
  const withApproval = rows.filter((r) => r.approved_at);
  if (!withApproval.length) return { date: null, by: null };
  const latest = withApproval.reduce((a, b) => (a.approved_at! > b.approved_at! ? a : b));
  return { date: latest.approved_at, by: latest.approved_by_name };
}

function CountryReports({
  country,
  recipes,
  prices,
}: {
  country: "in" | "us";
  recipes: RecipeRow[];
  prices: PriceRow[];
}) {
  const cur: Currency = country === "in" ? "inr" : "usd";
  const label = country === "in" ? "India" : "USA";
  const slug = country === "in" ? "india" : "usa";

  const countryRecipes = recipes.filter((recipe) => recipe.currency === cur);
  const approvedOnly = countryRecipes.filter((recipe) => recipe.status === "approved");
  const countryPrices = prices.filter((price) => price.currency === cur);

  const recipeCols: ExportColumn<RecipeRow>[] = [
    { key: "product_name", label: "Product" },
    { key: "brand", label: "Brand" },
    { key: "category", label: "Category" },
    { key: "version_no", label: "Version" },
    { key: "status", label: "Status" },
    { key: cur === "inr" ? "cost_inr" : "cost_usd", label: cur === "inr" ? "Cost ₹" : "Cost $" },
    {
      key: "approved_at",
      label: "Approved at",
      get: (row) => (row.approved_at ? fmtDate(row.approved_at) : "—"),
    },
    {
      key: "approved_by_name",
      label: "Approved by",
      get: (row) => row.approved_by_name ?? "—",
    },
  ];

  const priceCols: ExportColumn<PriceRow>[] = [
    { key: "changed_at", label: "When" },
    { key: "name", label: "Ingredient" },
    { key: "old_price", label: "Old" },
    { key: "new_price", label: "New" },
    { key: "delta_pct", label: "Δ %", get: (row) => row.delta_pct.toFixed(2) },
    { key: "reason", label: "Reason" },
  ];

  const recMeta = latestApproved(countryRecipes);
  const apprMeta = latestApproved(approvedOnly);
  const latestPriceDate = countryPrices[0]?.changed_at ?? null;

  return (
    <div className="space-y-3">
      <Section
        title={`1. ${label} Recipe Cost Sheet`}
        desc={`${countryRecipes.length} recipes costed in ${cur.toUpperCase()}`}
        date={fmtDate(recMeta.date)}
        approvedBy={recMeta.by ?? "—"}
        actions={exportSet(
          `${slug}-recipe-cost-sheet`,
          countryRecipes,
          recipeCols,
          `${label} Recipe Cost Sheet`,
        )}
      />
      <Section
        title={`2. ${label} Approved Recipe Report`}
        desc={`${approvedOnly.length} approved recipes`}
        date={fmtDate(apprMeta.date)}
        approvedBy={apprMeta.by ?? "—"}
        actions={exportSet(
          `${slug}-approved-recipes`,
          approvedOnly,
          recipeCols,
          `${label} Approved Recipe Report`,
        )}
      />
      <Section
        title={`3. ${label} Price Change Impact`}
        desc={`${countryPrices.length} ${cur.toUpperCase()} price changes (last 500)`}
        date={fmtDate(latestPriceDate)}
        approvedBy="—"
        actions={exportSet(
          `${slug}-price-impact`,
          countryPrices,
          priceCols,
          `${label} Price Change Impact`,
        )}
      />
      <Section
        title={`4. ${label} Ingredient Price History`}
        desc={`All ${cur.toUpperCase()} price changes with reason`}
        date={fmtDate(latestPriceDate)}
        approvedBy="—"
        actions={exportSet(
          `${slug}-price-history`,
          countryPrices,
          priceCols,
          `${label} Ingredient Price History`,
        )}
      />
      <Section
        title={`5. ${label} PPP & MRP Report`}
        desc="Approved recipe costs (apply category multiplier for PPP/MRP)"
        date={fmtDate(apprMeta.date)}
        approvedBy={apprMeta.by ?? "—"}
        actions={exportSet(
          `${slug}-ppp-mrp`,
          approvedOnly,
          recipeCols,
          `${label} PPP & MRP Report`,
        )}
      />
      <Section
        title={`6. ${label} Recipe Version History`}
        desc="See per-product Recipe Detail page for full version trail"
        date={fmtDate(recMeta.date)}
        approvedBy={recMeta.by ?? "—"}
        actions={null}
      />
    </div>
  );
}

function exportSet<T>(name: string, rows: T[], cols: ExportColumn<T>[], title: string) {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          exportCSV(name, rows, cols);
          toast.success("CSV downloaded");
        }}
      >
        <FileDown className="mr-1 h-3 w-3" />
        CSV
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          exportXLSX(name, rows, cols);
          toast.success("Excel downloaded");
        }}
      >
        <FileDown className="mr-1 h-3 w-3" />
        Excel
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          exportPDF(name, title, rows, cols);
          toast.success("PDF downloaded");
        }}
      >
        <FileDown className="mr-1 h-3 w-3" />
        PDF
      </Button>
    </div>
  );
}

function Section({
  title,
  desc,
  date,
  approvedBy,
  actions,
}: {
  title: string;
  desc: string;
  date: string;
  approvedBy: string;
  actions: ReactNode | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
        <p className="text-[11px] text-muted-foreground/80">
          <span className="font-medium">Date:</span> {date} <span className="mx-2">·</span>
          <span className="font-medium">Approved by:</span> {approvedBy}
        </p>
      </div>
      {actions}
    </div>
  );
}
