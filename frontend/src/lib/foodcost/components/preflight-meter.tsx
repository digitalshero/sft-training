import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import api from "@/lib/api/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

type Issue = { product_id?: string; category_id?: string; id?: string };
type Health = {
  orphans: Issue[];
  drift_categories: Issue[];
  drift_products: Issue[];
  veg_incomplete: Issue[];
  crc_broken: Issue[];
  zero_cost: Issue[];
  range_nutrition: Issue[];
};

type Country = "in" | "us";
type Brand = { id: string; name: string; code: string };

const ISSUE_KEYS = [
  "orphans",
  "drift_categories",
  "drift_products",
  "veg_incomplete",
  "crc_broken",
  "zero_cost",
  "range_nutrition",
] as const;

const ISSUE_META: Record<
  (typeof ISSUE_KEYS)[number],
  { label: string; tab: string; weight: number; severity: "critical" | "warn" | "info" }
> = {
  zero_cost: { label: "Zero-cost products", tab: "fc", weight: 5, severity: "critical" },
  crc_broken: { label: "CRC broken", tab: "fc", weight: 5, severity: "critical" },
  veg_incomplete: { label: "Veg incomplete", tab: "fc", weight: 3, severity: "critical" },
  orphans: { label: "Orphan products", tab: "fc", weight: 2, severity: "warn" },
  range_nutrition: { label: "Range nutrition gaps", tab: "nutri", weight: 1, severity: "warn" },
  drift_categories: { label: "Category drift", tab: "fc", weight: 0.1, severity: "info" },
  drift_products: { label: "Product drift", tab: "fc", weight: 0.05, severity: "info" },
};

type CountryReport = {
  country: Country;
  health: Health;
  total: number;
  weighted: number;
  critical: number;
  perBrand: Record<
    string,
    { total: number; weighted: number; critical: number; counts: Record<string, number> }
  >;
  counts: Record<string, number>;
};

function scoreFrom(weighted: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - weighted * 5)));
}

const toneText = (s: number) =>
  s >= 95
    ? "text-[var(--color-shero-emerald)]"
    : s >= 75
      ? "text-[oklch(0.55_0.13_85)]"
      : "text-[var(--color-destructive)]";

const toneChip = (s: number) =>
  s >= 95
    ? "bg-[var(--color-shero-emerald)]/12 text-[var(--color-shero-emerald)] ring-[var(--color-shero-emerald)]/30"
    : s >= 75
      ? "bg-[var(--color-shero-gold)]/20 text-[oklch(0.45_0.10_85)] ring-[var(--color-shero-gold)]/40"
      : "bg-[var(--color-destructive)]/12 text-[var(--color-destructive)] ring-[var(--color-destructive)]/30";

const statusLabel = (s: number) => (s >= 95 ? "Healthy" : s >= 75 ? "Watch" : "Critical");

export function PreflightMeter() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [reports, setReports] = useState<Record<Country, CountryReport | null>>({
    in: null,
    us: null,
  });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [brandsRes, inRes, usRes, catsRes, prodsRes] = await Promise.all([
      api.get("/foodcost/brands"),
      api.post("/foodcost/rpc/fc-data-health", { _country: "in" }),
      api.post("/foodcost/rpc/fc-data-health", { _country: "us" }),
      api.get("/foodcost/categories"),
      api.get("/foodcost/products"),
    ]);
    const bs = (brandsRes.data ?? []) as Brand[];
    const catToBrand = new Map<string, string>();
    (catsRes.data ?? []).forEach((c: { id: string; brand_id: string }) =>
      catToBrand.set(c.id, c.brand_id),
    );
    const prodToBrand = new Map<string, string>();
    (prodsRes.data ?? []).forEach((p: { id: string; category_id: string }) => {
      const b = catToBrand.get(p.category_id);
      if (b) prodToBrand.set(p.id, b);
    });

    function build(country: Country, h: Health): CountryReport {
      const perBrand: Record<
        string,
        { total: number; weighted: number; critical: number; counts: Record<string, number> }
      > = {};
      bs.forEach((b) => {
        perBrand[b.id] = { total: 0, weighted: 0, critical: 0, counts: {} };
      });
      const counts: Record<string, number> = {};
      let weighted = 0;
      let critical = 0;
      for (const k of ISSUE_KEYS) {
        const arr = (h?.[k] ?? []) as Issue[];
        counts[k] = arr.length;
        const meta = ISSUE_META[k];
        weighted += arr.length * meta.weight;
        if (meta.severity === "critical") critical += arr.length;
        for (const it of arr) {
          const bid = it.product_id
            ? prodToBrand.get(it.product_id)
            : it.category_id
              ? catToBrand.get(it.category_id)
              : it.id
                ? (catToBrand.get(it.id) ?? prodToBrand.get(it.id))
                : undefined;
          if (bid && perBrand[bid]) {
            perBrand[bid].total += 1;
            perBrand[bid].weighted += meta.weight;
            if (meta.severity === "critical") perBrand[bid].critical += 1;
            perBrand[bid].counts[k] = (perBrand[bid].counts[k] ?? 0) + 1;
          }
        }
      }
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      return { country, health: h, total, weighted, critical, perBrand, counts };
    }

    setBrands(bs);
    setReports({
      in: build("in", (inRes.data ?? {}) as Health),
      us: build("us", (usRes.data ?? {}) as Health),
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const grandTotal = (reports.in?.total ?? 0) + (reports.us?.total ?? 0);
  const grandWeighted = (reports.in?.weighted ?? 0) + (reports.us?.weighted ?? 0);
  const grandCritical = (reports.in?.critical ?? 0) + (reports.us?.critical ?? 0);
  const score = scoreFrom(grandWeighted);
  const clean = grandCritical === 0;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-6 shadow-[var(--shadow-card)] space-y-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-shero-teal)] via-[var(--color-shero-emerald)] to-[var(--color-shero-gold)]" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`grid h-12 w-12 place-items-center rounded-xl ring-1 ${toneChip(score)}`}>
            {clean ? <ShieldCheck className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Pre-flight Health</h2>
            <p className="text-xs text-muted-foreground">
              Weighted audit · critical issues block costing/nutrition; drift = status-flag noise.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1 rounded-xl border border-border bg-background/40 p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overall Score
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${toneChip(score)}`}
            >
              {statusLabel(score)}
            </span>
          </div>
          <div className={`mt-2 font-display text-5xl font-bold tabular-nums ${toneText(score)}`}>
            {score}
          </div>
          <Progress value={score} className="mt-3 h-2" />
          <div className="mt-3 flex justify-between text-xs">
            <span
              className={
                grandCritical > 0
                  ? "text-[var(--color-destructive)] font-semibold"
                  : "text-[var(--color-shero-emerald)] font-semibold"
              }
            >
              {grandCritical} critical
            </span>
            <span className="text-muted-foreground">{grandTotal} total</span>
          </div>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          {(["in", "us"] as Country[]).map((c) => {
            const r = reports[c];
            const cScore = scoreFrom(r?.weighted ?? 0);
            const crit = r?.critical ?? 0;
            const tot = r?.total ?? 0;
            return (
              <div
                key={c}
                className="rounded-xl border border-border bg-background/40 p-4 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider">
                    {c === "in" ? "🇮🇳 India" : "🇺🇸 USA"}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${toneChip(cScore)}`}
                  >
                    {statusLabel(cScore)}
                  </span>
                </div>
                <div
                  className={`mt-1 font-display text-3xl font-bold tabular-nums ${toneText(cScore)}`}
                >
                  {cScore}
                </div>
                <Progress value={cScore} className="mt-2 h-1.5" />
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span
                    className={
                      crit > 0
                        ? "text-[var(--color-destructive)] font-semibold"
                        : "text-[var(--color-shero-emerald)] font-semibold"
                    }
                  >
                    {crit} critical
                  </span>
                  <Link
                    to={c === "in" ? "/foodcost/in/audit" : "/foodcost/us/audit"}
                    className="text-[var(--color-shero-teal)] hover:underline"
                  >
                    Audit →
                  </Link>
                </div>
                <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
                  {tot} total
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(["critical", "warn", "info"] as const).map((sev) => {
        const keys = ISSUE_KEYS.filter((k) => ISSUE_META[k].severity === sev);
        const title =
          sev === "critical"
            ? "Critical (blocks costing/nutrition)"
            : sev === "warn"
              ? "Warnings"
              : "Drift (status flag noise)";
        const sectionBadge =
          sev === "critical"
            ? "bg-[var(--color-destructive)]/12 text-[var(--color-destructive)] ring-[var(--color-destructive)]/30"
            : sev === "warn"
              ? "bg-[var(--color-shero-gold)]/20 text-[oklch(0.45_0.10_85)] ring-[var(--color-shero-gold)]/40"
              : "bg-muted text-muted-foreground ring-border";
        return (
          <div key={sev}>
            <h3 className="mb-2 inline-flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${sectionBadge}`}
              >
                {sev}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {title}
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
              {keys.map((k) => {
                const inN = reports.in?.counts[k] ?? 0;
                const usN = reports.us?.counts[k] ?? 0;
                const total = inN + usN;
                const meta = ISSUE_META[k];
                const okBorder =
                  total === 0
                    ? "border-[var(--color-shero-emerald)]/30 bg-[var(--color-shero-emerald)]/5"
                    : sev === "critical"
                      ? "border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5"
                      : sev === "warn"
                        ? "border-[var(--color-shero-gold)]/40 bg-[var(--color-shero-gold)]/10"
                        : "border-border bg-background/40";
                const numTone =
                  total === 0
                    ? "text-[var(--color-shero-emerald)]"
                    : sev === "critical"
                      ? "text-[var(--color-destructive)]"
                      : sev === "warn"
                        ? "text-[oklch(0.48_0.10_85)]"
                        : "text-muted-foreground";
                return (
                  <div
                    key={k}
                    className={`rounded-xl border p-2.5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] ${okBorder}`}
                  >
                    <div
                      className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate"
                      title={meta.label}
                    >
                      {meta.label}
                    </div>
                    <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${numTone}`}>
                      {total === 0 ? <CheckCircle2 className="inline h-5 w-5" /> : total}
                    </div>
                    <div className="mt-1.5 flex gap-2 text-[10px] text-muted-foreground">
                      <Link
                        to="/foodcost/in/audit"
                        search={{ tab: meta.tab } as never}
                        className="rounded bg-background/60 px-1.5 py-0.5 hover:bg-background"
                      >
                        IN {inN}
                      </Link>
                      <Link
                        to="/foodcost/us/audit"
                        search={{ tab: meta.tab } as never}
                        className="rounded bg-background/60 px-1.5 py-0.5 hover:bg-background"
                      >
                        US {usN}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          By Brand
        </h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {brands.map((b) => {
            const inB = reports.in?.perBrand[b.id];
            const usB = reports.us?.perBrand[b.id];
            const inN = inB?.total ?? 0;
            const usN = usB?.total ?? 0;
            const crit = (inB?.critical ?? 0) + (usB?.critical ?? 0);
            const bScore = scoreFrom((inB?.weighted ?? 0) + (usB?.weighted ?? 0));
            return (
              <Link
                key={b.id}
                to="/foodcost/in/brand-master"
                className="block rounded-xl border border-border bg-background/40 p-3.5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-shero-teal)]/40 hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{b.name}</span>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1 ${toneChip(bScore)}`}
                  >
                    {b.code}
                  </span>
                </div>
                <div
                  className={`mt-1 font-display text-2xl font-bold tabular-nums ${toneText(bScore)}`}
                >
                  {bScore}
                </div>
                <Progress value={bScore} className="mt-2 h-1.5" />
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span
                    className={
                      crit > 0
                        ? "text-[var(--color-destructive)] font-semibold"
                        : "text-[var(--color-shero-emerald)] font-semibold"
                    }
                  >
                    {crit} crit
                  </span>
                  <span className="text-muted-foreground">
                    IN {inN} · US {usN}
                  </span>
                  {crit === 0 && inN + usN === 0 && (
                    <CheckCircle2 className="h-3 w-3 text-[var(--color-shero-emerald)]" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-xs">
        {[
          { to: "/foodcost/in/audit", label: "🇮🇳 IN · Full Audit" },
          { to: "/foodcost/us/audit", label: "🇺🇸 US · Full Audit" },
          { to: "/foodcost/in/missing-recipes", label: "IN · Missing Recipes" },
          { to: "/foodcost/us/missing-recipes", label: "US · Missing Recipes" },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="group flex items-center justify-between rounded-xl border border-border bg-background/40 px-3.5 py-2.5 font-medium shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-shero-teal)]/50 hover:text-[var(--color-shero-teal)] hover:shadow-[var(--shadow-elevated)]"
          >
            <span>{l.label}</span>
            <span className="opacity-0 transition group-hover:opacity-100">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
