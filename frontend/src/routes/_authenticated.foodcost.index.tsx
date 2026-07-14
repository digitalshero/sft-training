import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { PreflightMeter } from "@/lib/foodcost/components/preflight-meter";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ChefHat,
  FlaskConical,
  Package,
  ScrollText,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Utensils,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/foodcost/")({
  component: FoodCostDashboard,
});

type Currency = "inr" | "usd";

type Counts = {
  brands: number;
  categories: number;
  cats_active: number;
  products: number;
  prods_active: number;
  prods_no_recipe: number;
  ingredients: number;
  ing_active_in: number;
  ing_active_us: number;
  ing_no_inr_price: number;
  ing_no_usd_price: number;
  ing_no_nutri: number;
  ing_animal: number;
  preps: number;
  packing: number;
  recipes: number;
  rec_approved: number;
  rec_draft: number;
  rec_inr: number;
  rec_usd: number;
  pl_total: number;
  pl_inr: number;
  pl_usd: number;
  pl_draft: number;
  pl_submitted: number;
  pl_approved: number;
  price_changes_30d: number;
};

type CountryStats = {
  latestApproved: {
    id: string;
    name: string;
    approved_at: string | null;
  } | null;
  recentPrices: {
    id: string;
    name: string;
    old_price: number;
    new_price: number;
    changed_at: string;
  }[];
  topCost: { product_name: string; cost: number }[];
  trend: { d: string; n: number }[];
};

type Stats = {
  c: Counts;
  topCategories: { name: string; n: number }[];
  inr: CountryStats;
  usd: CountryStats;
};

function FoodCostDashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const country: string | undefined = undefined;

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCountry(currency: Currency): Promise<CountryStats> {
    const [recipesRes, plRes, pricesRes, trendRes] = await Promise.all([
      api.get("/foodcost/recipes", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/price-lists", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/ingredient-price-history", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/ingredient-price-history", {
        params: { country: country ?? undefined },
      }),
    ]);

    const recipeRows = (recipesRes.data ?? []) as unknown as Array<{
      id: string;
      current_version_id: string | null;
      fc_products: { name: string } | null;
      fc_recipe_versions:
        { currency: Currency } | { currency: Currency }[] | null;
    }>;
    const matching = recipeRows.filter((r) => {
      if (!r.current_version_id) return false;
      const v = r.fc_recipe_versions;
      const c = Array.isArray(v) ? v[0]?.currency : v?.currency;
      return c === currency;
    });

    const versionIds = matching.map((r) => r.current_version_id!) as string[];
    let topCost: { product_name: string; cost: number }[] = [];
    if (versionIds.length) {
      const costs = await api.get("/foodcost/recipe-versions", {
        params: { version_id: versionIds },
      });
      const costRows = (costs.data ?? []) as Array<{
        version_id: string;
        cost_inr?: number;
        cost_usd?: number;
      }>;
      const costMap = new Map(costRows.map((c) => [c.version_id, c]));
      topCost = matching
        .map((r) => {
          const c = costMap.get(r.current_version_id!) as
            { cost_inr?: number; cost_usd?: number } | undefined;
          return {
            product_name: r.fc_products?.name ?? "—",
            cost: Number((currency === "inr" ? c?.cost_inr : c?.cost_usd) ?? 0),
          };
        })
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 8);
    }

    const pls = (plRes.data ?? []) as Array<{
      id: string;
      name: string;
      status: string;
      updated_at: string;
    }>;
    const latestApproved = pls.find((p) => p.status === "approved");

    const trendMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      trendMap.set(d.toISOString().slice(0, 10), 0);
    }
    ((trendRes.data ?? []) as { changed_at: string }[]).forEach((r) => {
      const k = new Date(r.changed_at).toISOString().slice(0, 10);
      if (trendMap.has(k)) trendMap.set(k, (trendMap.get(k) ?? 0) + 1);
    });

    return {
      latestApproved: latestApproved
        ? {
            id: latestApproved.id,
            name: latestApproved.name,
            approved_at: latestApproved.updated_at,
          }
        : null,
      recentPrices: (
        (pricesRes.data ?? []) as Array<{
          id: string;
          old_price: number;
          new_price: number;
          changed_at: string;
          fc_ingredients: { name: string } | null;
        }>
      ).map((p) => ({
        id: p.id,
        name: p.fc_ingredients?.name ?? "—",
        old_price: p.old_price,
        new_price: p.new_price,
        changed_at: p.changed_at,
      })),
      topCost,
      trend: Array.from(trendMap.entries()).map(([d, n]) => ({
        d: d.slice(5),
        n,
      })),
    };
  }

  async function load() {
    const counts: Counts = {
      brands: 0,
      categories: 0,
      cats_active: 0,
      products: 0,
      prods_active: 0,
      prods_no_recipe: 0,
      ingredients: 0,
      ing_active_in: 0,
      ing_active_us: 0,
      ing_no_inr_price: 0,
      ing_no_usd_price: 0,
      ing_no_nutri: 0,
      ing_animal: 0,
      preps: 0,
      packing: 0,
      recipes: 0,
      rec_approved: 0,
      rec_draft: 0,
      rec_inr: 0,
      rec_usd: 0,
      pl_total: 0,
      pl_inr: 0,
      pl_usd: 0,
      pl_draft: 0,
      pl_submitted: 0,
      pl_approved: 0,
      price_changes_30d: 0,
    };

    type QueryBuilder = {
      eq: (column: string, value: string | number | boolean | null) => unknown;
      or: (condition: string) => unknown;
      gte: (column: string, value: string | number | Date) => unknown;
    };

    const head = (
      tbl: string,
      filter?: (q: QueryBuilder) => unknown,
    ): Promise<{ count: number }> => {
      // Count query migrated - returns promise resolving to {count: number}
      return api
        .get(`/foodcost/${tbl.replace(/_/g, "-")}`, { params: { count: true } })
        .then((r) => ({ count: Array.isArray(r.data) ? r.data.length : 0 }));
    };

    const [
      brandsR,
      catsR,
      catsActR,
      prodsR,
      prodsActR,
      ingsR,
      ingInR,
      ingUsR,
      ingNoInrR,
      ingNoUsdR,
      ingAnimalR,
      prepsR,
      packingR,
      recipesR,
      recApprR,
      recDraftR,
      plR,
      plInrR,
      plUsdR,
      plDraftR,
      plSubR,
      plApprR,
      priceR,
      recipesAllR,
      productsAllR,
      catsAggR,
    ] = await Promise.all([
      head("fc_brands"),
      head("fc_categories"),
      head("fc_categories", (q) => q.eq("status", "active")),
      head("fc_products"),
      head("fc_products", (q) => q.eq("status", "active")),
      head("fc_ingredients"),
      head("fc_ingredients", (q) => q.eq("active_in", true)),
      head("fc_ingredients", (q) => q.eq("active_us", true)),
      head("fc_ingredients", (q) => q.or("price_inr.is.null,price_inr.eq.0")),
      head("fc_ingredients", (q) => q.or("price_usd.is.null,price_usd.eq.0")),
      head("fc_ingredients", (q) => q.eq("is_animal_origin", true)),
      head("fc_preps"),
      head("fc_packing_containers"),
      head("fc_recipes"),
      head("fc_recipes", (q) => q.eq("status", "approved")),
      head("fc_recipes", (q) => q.eq("status", "draft")),
      head("fc_price_lists"),
      head("fc_price_lists", (q) => q.eq("currency", "inr")),
      head("fc_price_lists", (q) => q.eq("currency", "usd")),
      head("fc_price_lists", (q) => q.eq("status", "draft")),
      head("fc_price_lists", (q) => q.eq("status", "submitted")),
      head("fc_price_lists", (q) => q.eq("status", "approved")),
      head("fc_ingredient_price_history", (q) =>
        q.gte("changed_at", new Date(Date.now() - 30 * 86400000).toISOString()),
      ),
      api.get("/foodcost/recipes", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/products", {
        params: { country: country ?? undefined },
      }),
      api.get("/foodcost/categories", {
        params: { country: country ?? undefined },
      }),
    ]);

    counts.brands = brandsR.count ?? 0;
    counts.categories = catsR.count ?? 0;
    counts.cats_active = catsActR.count ?? 0;
    counts.products = prodsR.count ?? 0;
    counts.prods_active = prodsActR.count ?? 0;
    counts.ingredients = ingsR.count ?? 0;
    counts.ing_active_in = ingInR.count ?? 0;
    counts.ing_active_us = ingUsR.count ?? 0;
    counts.ing_no_inr_price = ingNoInrR.count ?? 0;
    counts.ing_no_usd_price = ingNoUsdR.count ?? 0;
    counts.ing_animal = ingAnimalR.count ?? 0;
    counts.preps = prepsR.count ?? 0;
    counts.packing = packingR.count ?? 0;
    counts.recipes = recipesR.count ?? 0;
    counts.rec_approved = recApprR.count ?? 0;
    counts.rec_draft = recDraftR.count ?? 0;
    counts.pl_total = plR.count ?? 0;
    counts.pl_inr = plInrR.count ?? 0;
    counts.pl_usd = plUsdR.count ?? 0;
    counts.pl_draft = plDraftR.count ?? 0;
    counts.pl_submitted = plSubR.count ?? 0;
    counts.pl_approved = plApprR.count ?? 0;
    counts.price_changes_30d = priceR.count ?? 0;

    const recAll = (recipesAllR.data ?? []) as Array<{
      current_version_id: string | null;
      fc_recipe_versions:
        { currency: Currency } | { currency: Currency }[] | null;
    }>;
    const productRecipeIds = new Set<string>();
    recAll.forEach((r) => {
      const v = r.fc_recipe_versions;
      const c = Array.isArray(v) ? v[0]?.currency : v?.currency;
      if (c === "inr") counts.rec_inr++;
      if (c === "usd") counts.rec_usd++;
    });

    const products = (productsAllR.data ?? []) as {
      id: string;
      category_id: string | null;
    }[];
    const productsWithRecipes = await api.get("/foodcost/recipes", {
      params: { country: country ?? undefined },
    });
    const withRec = new Set(
      ((productsWithRecipes.data ?? []) as { product_id: string }[]).map(
        (r) => r.product_id,
      ),
    );
    counts.prods_no_recipe = products.filter((p) => !withRec.has(p.id)).length;
    void productRecipeIds;

    const catMap = new Map(
      ((catsAggR.data ?? []) as { id: string; name: string }[]).map((c) => [
        c.id,
        c.name,
      ]),
    );
    const tally = new Map<string, number>();
    products.forEach((p) => {
      if (!p.category_id) return;
      tally.set(p.category_id, (tally.get(p.category_id) ?? 0) + 1);
    });
    const topCategories = Array.from(tally.entries())
      .map(([id, n]) => ({ name: catMap.get(id) ?? "—", n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);

    const [inr, usd] = await Promise.all([
      loadCountry("inr"),
      loadCountry("usd"),
    ]);

    setS({ c: counts, topCategories, inr, usd });
  }

  if (!s) return <DashboardSkeleton />;

  const { c } = s;
  const recipeCoverage = c.products
    ? Math.round(((c.products - c.prods_no_recipe) / c.products) * 100)
    : 0;
  const approvedShare = c.recipes
    ? Math.round((c.rec_approved / c.recipes) * 100)
    : 0;

  // combined sparkline for "Price Changes · 30d" hero card
  const combinedTrend = s.inr.trend.map((d, i) => ({
    d: d.d,
    n: d.n + (s.usd.trend[i]?.n ?? 0),
  }));

  return (
    <div className="space-y-8">
      {/* HERO STATS */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          icon={<Utensils className="h-5 w-5" />}
          label="Menu Products"
          value={c.products}
          sub={`${c.prods_active} active · ${c.products - c.prods_active} archived`}
          tone="teal"
        />
        <HeroStat
          icon={<ChefHat className="h-5 w-5" />}
          label="Recipes"
          value={c.recipes}
          sub={`${approvedShare}% approved · ${c.rec_draft} in draft`}
          tone="emerald"
          progress={approvedShare}
        />
        <HeroStat
          icon={<FlaskConical className="h-5 w-5" />}
          label="Ingredients"
          value={c.ingredients}
          sub={`${c.ing_active_in} IN · ${c.ing_active_us} US`}
          tone="sand"
        />
        <HeroStat
          icon={<Activity className="h-5 w-5" />}
          label="Price Changes · 30d"
          value={c.price_changes_30d}
          sub={`${c.pl_approved} approved price lists live`}
          tone="gold"
          sparkline={combinedTrend}
        />
      </section>

      <PreflightMeter />

      {/* SECONDARY KPI STRIP */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MiniTile
          to="/foodcost/in/categories"
          icon={<ScrollText className="h-4 w-4" />}
          label="Categories"
          value={c.categories}
          hint={`${c.cats_active} live`}
        />
        <MiniTile
          to="/foodcost/in/products"
          icon={<Utensils className="h-4 w-4" />}
          label="Products"
          value={c.products}
          hint={`${recipeCoverage}% costed`}
        />
        <MiniTile
          to="/foodcost/in/ingredients"
          icon={<FlaskConical className="h-4 w-4" />}
          label="Ingredients"
          value={c.ingredients}
          hint={`${c.ing_animal} animal-origin`}
        />
        <MiniTile
          to="/foodcost/in/preps"
          icon={<Sparkles className="h-4 w-4" />}
          label="Pre-Preps"
          value={c.preps}
          hint="reusable bases"
        />
        <MiniTile
          to="/foodcost/in/packing"
          icon={<Package className="h-4 w-4" />}
          label="Packing"
          value={c.packing}
          hint="containers"
        />
        <MiniTile
          to="/foodcost/in/price-lists"
          icon={<Boxes className="h-4 w-4" />}
          label="Price Lists"
          value={c.pl_total}
          hint={`${c.pl_approved} approved`}
        />
      </section>

      {/* INFOGRAPHICS ROW */}
      <section className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Recipe Coverage"
          subtitle="Products with at least one recipe"
        >
          <CoverageDonut
            value={recipeCoverage}
            covered={c.products - c.prods_no_recipe}
            missing={c.prods_no_recipe}
          />
        </Panel>

        <Panel
          title="Recipes by Country"
          subtitle="Current versions split by currency"
        >
          <CountrySplitChart inr={c.rec_inr} usd={c.rec_usd} />
        </Panel>

        <Panel title="Data Integrity" subtitle="Gaps that block clean costing">
          <IntegrityList
            rows={[
              {
                label: "Ingredients missing INR price",
                n: c.ing_no_inr_price,
                total: c.ingredients,
                tone: "warn",
              },
              {
                label: "Ingredients missing USD price",
                n: c.ing_no_usd_price,
                total: c.ingredients,
                tone: "warn",
              },
              {
                label: "Products without a recipe",
                n: c.prods_no_recipe,
                total: c.products,
                tone: "critical",
              },
              {
                label: "Recipes still in draft",
                n: c.rec_draft,
                total: c.recipes,
                tone: "info",
              },
            ]}
          />
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Top Categories by Product Count"
          subtitle="Where the menu concentrates"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={s.topCategories}
              layout="vertical"
              margin={{ left: 12, right: 28, top: 8, bottom: 8 }}
            >
              <defs>
                <linearGradient id="barTealEmerald" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--color-chart-1)" />
                  <stop offset="100%" stopColor="var(--color-chart-2)" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
              />
              <Bar
                dataKey="n"
                fill="url(#barTealEmerald)"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Price List Pipeline"
          subtitle="Workflow status across IN + US"
        >
          <PipelineFlow
            approved={c.pl_approved}
            submitted={c.pl_submitted}
            draft={c.pl_draft}
            inr={c.pl_inr}
            usd={c.pl_usd}
          />
        </Panel>
      </section>

      {/* COUNTRY PANELS */}
      <section className="grid gap-5 lg:grid-cols-2">
        <CountryPanel
          title="India Operations"
          symbol="₹"
          code="INR"
          recipes={c.rec_inr}
          stats={s.inr}
          accent="emerald"
        />
        <CountryPanel
          title="USA Operations"
          symbol="$"
          code="USD"
          recipes={c.rec_usd}
          stats={s.usd}
          accent="teal"
        />
      </section>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "var(--shadow-card)",
};

type Tone = "teal" | "emerald" | "gold" | "sand";

const HERO_TONE: Record<
  Tone,
  { grad: string; icon: string; ring: string; bar: string }
> = {
  teal: {
    grad: "from-[var(--color-shero-teal)]/10 via-[var(--color-shero-teal)]/[0.04] to-transparent",
    icon: "bg-[var(--color-shero-teal)]/12 text-[var(--color-shero-teal)]",
    ring: "ring-[var(--color-shero-teal)]/20",
    bar: "bg-[var(--color-shero-teal)]",
  },
  emerald: {
    grad: "from-[var(--color-shero-emerald)]/12 via-[var(--color-shero-emerald)]/[0.04] to-transparent",
    icon: "bg-[var(--color-shero-emerald)]/15 text-[var(--color-shero-emerald)]",
    ring: "ring-[var(--color-shero-emerald)]/25",
    bar: "bg-[var(--color-shero-emerald)]",
  },
  gold: {
    grad: "from-[var(--color-shero-gold)]/15 via-[var(--color-shero-gold)]/[0.05] to-transparent",
    icon: "bg-[var(--color-shero-gold)]/20 text-[oklch(0.48_0.10_85)]",
    ring: "ring-[var(--color-shero-gold)]/30",
    bar: "bg-[var(--color-shero-gold)]",
  },
  sand: {
    grad: "from-[var(--color-shero-sand)] via-[var(--color-shero-sand)]/40 to-transparent",
    icon: "bg-[var(--color-shero-teal)]/10 text-[var(--color-shero-teal)]",
    ring: "ring-[var(--color-shero-teal)]/15",
    bar: "bg-[var(--color-shero-teal)]/70",
  },
};

function HeroStat({
  icon,
  label,
  value,
  sub,
  tone,
  progress,
  sparkline,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  progress?: number;
  sparkline?: { d: string; n: number }[];
}) {
  const t = HERO_TONE[tone];
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated ring-1 ${t.ring} shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${t.grad} pointer-events-none`}
      />
      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div
            className={`grid h-11 w-11 place-items-center rounded-xl ${t.icon}`}
          >
            {icon}
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:text-foreground" />
        </div>
        <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">
          {value.toLocaleString()}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
        {progress !== undefined && (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background/70">
            <div
              className={`h-full rounded-full ${t.bar}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {sparkline && (
          <div className="-mx-1 mt-3 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sparkline}
                margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`spark-${tone}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--color-shero-gold)"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-shero-gold)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="n"
                  stroke="var(--color-shero-gold)"
                  strokeWidth={1.75}
                  fill={`url(#spark-${tone})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTile({
  to,
  icon,
  label,
  value,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border bg-surface-elevated p-3.5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-shero-teal)]/40 hover:shadow-[var(--shadow-elevated)]"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-shero-teal)]/10 text-[var(--color-shero-teal)]">
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </Link>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface-elevated p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elevated)] ${className}`}
    >
      <div className="mb-4">
        <h3 className="font-display text-base font-bold tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({
  kind,
  children,
}: {
  kind: "approved" | "submitted" | "draft" | "critical" | "warning" | "healthy";
  children: React.ReactNode;
}) {
  const map = {
    approved:
      "bg-[var(--color-shero-emerald)]/12 text-[var(--color-shero-emerald)] ring-[var(--color-shero-emerald)]/30",
    healthy:
      "bg-[var(--color-shero-emerald)]/12 text-[var(--color-shero-emerald)] ring-[var(--color-shero-emerald)]/30",
    submitted:
      "bg-[var(--color-shero-gold)]/20 text-[oklch(0.45_0.10_85)] ring-[var(--color-shero-gold)]/40",
    warning:
      "bg-[var(--color-shero-gold)]/20 text-[oklch(0.45_0.10_85)] ring-[var(--color-shero-gold)]/40",
    draft: "bg-muted text-muted-foreground ring-border",
    critical:
      "bg-[var(--color-destructive)]/12 text-[var(--color-destructive)] ring-[var(--color-destructive)]/30",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${map[kind]}`}
    >
      {children}
    </span>
  );
}

function CoverageDonut({
  value,
  covered,
  missing,
}: {
  value: number;
  covered: number;
  missing: number;
}) {
  const data = [
    { name: "Costed", v: covered },
    { name: "Missing", v: missing },
  ];
  const colors = ["var(--color-shero-teal)", "var(--color-shero-sand)"];
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="v"
            nameKey="name"
            innerRadius={68}
            outerRadius={96}
            stroke="none"
            paddingAngle={3}
            cornerRadius={6}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-4xl font-bold tabular-nums text-[var(--color-shero-teal)]">
          {value}%
        </div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          covered
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-5 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-[var(--color-shero-teal)]" />
          <b className="text-foreground tabular-nums">{covered}</b> costed
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-[var(--color-shero-sand)] ring-1 ring-border" />
          <b className="text-foreground tabular-nums">{missing}</b> missing
        </span>
      </div>
    </div>
  );
}

function CountrySplitChart({ inr, usd }: { inr: number; usd: number }) {
  const data = [
    { name: "India", v: inr, fill: "var(--color-shero-emerald)" },
    { name: "USA", v: usd, fill: "var(--color-shero-teal)" },
  ];
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="var(--color-muted-foreground)"
            fontSize={11}
          />
          <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
          />
          <Bar dataKey="v" radius={[10, 10, 0, 0]} maxBarSize={70}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-background/40 p-2">
          <div className="font-display text-lg font-bold tabular-nums text-[var(--color-shero-emerald)]">
            {inr}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            India
          </div>
        </div>
        <div className="rounded-lg bg-background/40 p-2">
          <div className="font-display text-lg font-bold tabular-nums text-[var(--color-shero-teal)]">
            {usd}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            USA
          </div>
        </div>
        <div className="rounded-lg bg-background/40 p-2">
          <div className="font-display text-lg font-bold tabular-nums">
            {inr + usd}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrityList({
  rows,
}: {
  rows: {
    label: string;
    n: number;
    total: number;
    tone: "warn" | "critical" | "info";
  }[];
}) {
  const barFill: Record<string, string> = {
    warn: "bg-[var(--color-shero-gold)]",
    critical: "bg-[var(--color-destructive)]",
    info: "bg-[var(--color-shero-teal)]",
  };
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => {
        const pct = r.total ? Math.round((r.n / r.total) * 100) : 0;
        const ok = r.n === 0;
        const badge = ok ? (
          <StatusBadge kind="healthy">ok</StatusBadge>
        ) : r.tone === "critical" ? (
          <StatusBadge kind="critical">critical</StatusBadge>
        ) : r.tone === "warn" ? (
          <StatusBadge kind="warning">warning</StatusBadge>
        ) : (
          <StatusBadge kind="draft">info</StatusBadge>
        );
        return (
          <li
            key={r.label}
            className="rounded-lg p-2 -mx-2 transition hover:bg-background/40"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {!ok && r.tone !== "info" && (
                  <AlertTriangle className="h-3 w-3 text-[var(--color-shero-gold)]" />
                )}
                {r.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  <b>{r.n}</b>{" "}
                  <span className="text-muted-foreground">
                    / {r.total} · {pct}%
                  </span>
                </span>
                {badge}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background/70">
              <div
                className={`h-full rounded-full ${ok ? "bg-[var(--color-shero-emerald)]" : barFill[r.tone]} transition-[width] duration-500`}
                style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PipelineFlow({
  approved,
  submitted,
  draft,
  inr,
  usd,
}: {
  approved: number;
  submitted: number;
  draft: number;
  inr: number;
  usd: number;
}) {
  const total = approved + submitted + draft || 1;
  return (
    <div className="space-y-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-background/70 ring-1 ring-border">
        <div
          className="bg-[var(--color-shero-emerald)]"
          style={{ width: `${(approved / total) * 100}%` }}
        />
        <div
          className="bg-[var(--color-shero-gold)]"
          style={{ width: `${(submitted / total) * 100}%` }}
        />
        <div
          className="bg-muted-foreground/40"
          style={{ width: `${(draft / total) * 100}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Step label="Draft" n={draft} kind="draft" />
        <Step label="Submitted" n={submitted} kind="submitted" />
        <Step label="Approved" n={approved} kind="approved" />
      </div>
      <div className="rounded-xl border border-border bg-background/40 p-3.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          By region
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm">🇮🇳 India</span>
          <span className="font-display text-lg font-bold tabular-nums text-[var(--color-shero-emerald)]">
            {inr}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-sm">🇺🇸 USA</span>
          <span className="font-display text-lg font-bold tabular-nums text-[var(--color-shero-teal)]">
            {usd}
          </span>
        </div>
      </div>
    </div>
  );
}

function Step({
  label,
  n,
  kind,
}: {
  label: string;
  n: number;
  kind: "approved" | "submitted" | "draft";
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-2.5 text-center">
      <StatusBadge kind={kind}>{label}</StatusBadge>
      <div className="mt-1.5 font-display text-xl font-bold tabular-nums">
        {n}
      </div>
    </div>
  );
}

function CountryPanel({
  title,
  symbol,
  code,
  recipes,
  stats,
  accent,
}: {
  title: string;
  symbol: string;
  code: "INR" | "USD";
  recipes: number;
  stats: CountryStats;
  accent: "emerald" | "teal";
}) {
  const isEm = accent === "emerald";
  const tint = isEm ? "var(--color-shero-emerald)" : "var(--color-shero-teal)";
  const wrapCls = `relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-5 shadow-[var(--shadow-card)] space-y-5 transition hover:shadow-[var(--shadow-elevated)]`;
  const flag = code === "INR" ? "🇮🇳" : "🇺🇸";
  const trendTotal = stats.trend.reduce((s, d) => s + d.n, 0);
  const maxCost = useMemo(
    () => Math.max(1, ...stats.topCost.map((t) => t.cost)),
    [stats.topCost],
  );
  const gradId = `country-spark-${code}`;

  return (
    <div
      className={wrapCls}
      style={{ borderTopColor: tint, borderTopWidth: 3 }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-3xl"
        style={{ background: tint }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">
            {flag} {title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {recipes} recipes priced in {code}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1"
          style={{
            background: `color-mix(in oklab, ${tint} 12%, transparent)`,
            color: tint,
            borderColor: tint,
          }}
        >
          {code} · {symbol}
        </span>
      </div>

      {/* 30-day price activity */}
      <div className="rounded-xl border border-border bg-background/40 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Price activity · 30d
            </div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">
              {trendTotal}
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${trendTotal > 0 ? "bg-[var(--color-shero-emerald)]/12 text-[var(--color-shero-emerald)] ring-[var(--color-shero-emerald)]/30" : "bg-muted text-muted-foreground ring-border"}`}
          >
            {trendTotal > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trendTotal > 0 ? "active" : "quiet"}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart
            data={stats.trend}
            margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={tint} stopOpacity={0.35} />
                <stop offset="100%" stopColor={tint} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="n"
              stroke={tint}
              strokeWidth={2}
              fill={`url(#${gradId})`}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(l) => `Day ${l}`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <Sub title="Latest approved price list">
        {stats.latestApproved ? (
          <Link
            to={code === "INR" ? "/foodcost/in" : "/foodcost/us"}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-sm transition hover:border-[var(--color-shero-teal)]/40 hover:bg-background/70"
          >
            <span className="flex items-center gap-2 truncate">
              <StatusBadge kind="approved">approved</StatusBadge>
              <span className="truncate">{stats.latestApproved.name}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {stats.latestApproved.approved_at
                ? new Date(
                    stats.latestApproved.approved_at,
                  ).toLocaleDateString()
                : ""}
            </span>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">None yet.</p>
        )}
      </Sub>

      <Sub title="Recent ingredient price changes">
        {stats.recentPrices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent changes.</p>
        ) : (
          <ul className="space-y-1">
            {stats.recentPrices.map((p) => {
              const delta = Number(p.new_price) - Number(p.old_price);
              const pct = p.old_price > 0 ? (delta / p.old_price) * 100 : 0;
              const up = delta > 0;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border-b border-border/40 py-1.5 text-sm last:border-0"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                    <span>
                      {symbol}
                      {Number(p.old_price).toFixed(2)} →{" "}
                      <b className="text-foreground">
                        {symbol}
                        {Number(p.new_price).toFixed(2)}
                      </b>
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${up ? "bg-[var(--color-destructive)]/10 text-[var(--color-destructive)] ring-[var(--color-destructive)]/25" : "bg-[var(--color-shero-emerald)]/12 text-[var(--color-shero-emerald)] ring-[var(--color-shero-emerald)]/30"}`}
                    >
                      {up ? (
                        <TrendingUp className="h-2.5 w-2.5" />
                      ) : (
                        <TrendingDown className="h-2.5 w-2.5" />
                      )}
                      {pct.toFixed(0)}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Sub>

      <Sub title="Top 8 highest cost recipes">
        {stats.topCost.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipes yet.</p>
        ) : (
          <ul className="space-y-2">
            {stats.topCost.map((r, i) => {
              const isTop = i === 0;
              return (
                <li key={i} className="text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="truncate">
                      <span
                        className={`mr-1 font-semibold ${isTop ? "text-[oklch(0.55_0.13_85)]" : "text-muted-foreground"}`}
                      >
                        {i + 1}.
                      </span>
                      {r.product_name}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {symbol}
                      {r.cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background/70">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(r.cost / maxCost) * 100}%`,
                        background: isTop
                          ? `linear-gradient(90deg, ${tint}, var(--color-shero-gold))`
                          : tint,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Sub>
    </div>
  );
}

function Sub({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

// Suppress unused warning (LineChart kept for potential future use, but Area now used)
void LineChart;
void Line;

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl border border-border bg-surface-elevated shadow-[var(--shadow-card)]"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface-elevated shadow-[var(--shadow-card)]" />
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl border border-border bg-surface-elevated shadow-[var(--shadow-card)]"
          />
        ))}
      </div>
    </div>
  );
}
