// USD → INR FX used for showing Indian-standard equivalents on the US ingredient page.
// Tunable in one place. Set to match the example: $3.99 / 32 oz ≈ ₹0.42 / ml ⇒ FX ≈ 100.
export const FC_USD_TO_INR = 100;

/** Metric equivalent (per 1 unit) for any unit code. Used to convert
 *  "price per <unit>" into "price per metric base unit (ml or g)". */
type MetricKind = "volume" | "weight" | "count";

const UNIT_INFO: Record<
  string,
  { kind: MetricKind; perBase: number; metricCode: "ml" | "g" | "pcs" }
> = {
  // volume (base = ml)
  ml: { kind: "volume", perBase: 1, metricCode: "ml" },
  l: { kind: "volume", perBase: 1000, metricCode: "ml" },
  tbsp: { kind: "volume", perBase: 15, metricCode: "ml" },
  tsp: { kind: "volume", perBase: 5, metricCode: "ml" },
  cup: { kind: "volume", perBase: 240, metricCode: "ml" },
  fl_oz: { kind: "volume", perBase: 29.5735, metricCode: "ml" },
  gal: { kind: "volume", perBase: 3785.41, metricCode: "ml" },
  qt: { kind: "volume", perBase: 946.353, metricCode: "ml" },
  pt: { kind: "volume", perBase: 473.176, metricCode: "ml" },
  // weight (base = g)
  g: { kind: "weight", perBase: 1, metricCode: "g" },
  kg: { kind: "weight", perBase: 1000, metricCode: "g" },
  pinch: { kind: "weight", perBase: 0.3, metricCode: "g" },
  oz: { kind: "weight", perBase: 28.3495, metricCode: "g" },
  lb: { kind: "weight", perBase: 453.592, metricCode: "g" },
  // count
  pcs: { kind: "count", perBase: 1, metricCode: "pcs" },
  packet: { kind: "count", perBase: 1, metricCode: "pcs" },
  lump: { kind: "count", perBase: 1, metricCode: "pcs" },
};

export type MetricEquivalent = { inrPerMetric: number; metricUnit: "ml" | "g" | "pcs" } | null;

/** Given a price in USD per `unitCode`, return the INR price per matching metric unit. */
export function usdUnitToInrMetric(priceUsdPerUnit: number, unitCode: string): MetricEquivalent {
  const info = UNIT_INFO[unitCode];
  if (!info) return null;
  // price per 1 ml / 1 g / 1 pcs in USD, then × FX
  const usdPerMetric = priceUsdPerUnit / info.perBase;
  return { inrPerMetric: usdPerMetric * FC_USD_TO_INR, metricUnit: info.metricCode };
}
