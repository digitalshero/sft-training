import { useEffect, useState } from "react";
import api from "@/lib/api/client";
import { fmtRange, nutriRange, nutritionBadges, type NutritionResult } from "@/lib/foodcost/types";

export function NutritionCard({
  categoryId,
  productName = "",
}: {
  categoryId: string;
  productName?: string;
}) {
  const [data, setData] = useState<NutritionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get(`/foodcost/categories/${categoryId}/nutrition`).then(({ data }) => {
      if (mounted) {
        setData((data as NutritionResult) ?? null);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  if (loading)
    return (
      <div className="rounded-2xl border border-border bg-surface-elevated p-4">
        <h3 className="text-sm font-semibold">Nutrition (per 100g/ml)</h3>
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      </div>
    );

  if (!data || !data.with_veg?.length)
    return (
      <div className="rounded-2xl border border-border bg-surface-elevated p-4">
        <h3 className="text-sm font-semibold">Nutrition (per 100g/ml)</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Add ingredients to the CRC recipe and set their nutrition values to compute.
        </p>
      </div>
    );

  const rows = data.with_veg;
  const kcal = nutriRange(rows, "kcal");
  const protein = nutriRange(rows, "protein");
  const carbs = nutriRange(rows, "carbs");
  const fat = nutriRange(rows, "fat");
  const fibre = nutriRange(rows, "fibre");
  // For badge eligibility use midpoint
  const mid = {
    kcal: (kcal.min + kcal.max) / 2,
    protein: (protein.min + protein.max) / 2,
    carbs: (carbs.min + carbs.max) / 2,
    fat: (fat.min + fat.max) / 2,
    fibre: (fibre.min + fibre.max) / 2,
  };
  const badges = nutritionBadges(mid, data.is_vegan, productName);

  const rowCls =
    "flex items-baseline justify-between border-b border-border/40 py-1.5 last:border-0";

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Nutrition</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          per 100g/ml
        </span>
      </div>

      {badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.label}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.tone}`}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 text-sm">
        <div className={rowCls}>
          <span className="text-muted-foreground">Calories</span>
          <span className="font-display font-semibold tabular-nums">
            {fmtRange(kcal.min, kcal.max, " kcal", 0)}
          </span>
        </div>
        <div className={rowCls}>
          <span className="text-muted-foreground">Protein</span>
          <span className="font-display font-semibold tabular-nums">
            {fmtRange(protein.min, protein.max)}
          </span>
        </div>
        <div className={rowCls}>
          <span className="text-muted-foreground">Carbs</span>
          <span className="font-display font-semibold tabular-nums">
            {fmtRange(carbs.min, carbs.max)}
          </span>
        </div>
        <div className={rowCls}>
          <span className="text-muted-foreground">Fat</span>
          <span className="font-display font-semibold tabular-nums">
            {fmtRange(fat.min, fat.max)}
          </span>
        </div>
        <div className={rowCls}>
          <span className="text-muted-foreground">Fibre</span>
          <span className="font-display font-semibold tabular-nums">
            {fmtRange(fibre.min, fibre.max)}
          </span>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        Range reflects different vegetable choices for this category. Update per-ingredient values
        from the Ingredients page.
      </p>
    </div>
  );
}
