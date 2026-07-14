// Single source of truth for product pricing across all brands, categories, and countries.
//
// Formula (canonical example: FC=2.5 → PTR Margin=5.0, PPP=7.5, Shero=4.0, MRP=11.5):
//   PTR Margin   = FC × 2
//   PPP          = FC + PTR Margin       (= FC × 3)
//   Shero Margin = FC × 1.6
//   MRP          = PPP + Shero Margin    (= FC × 4.6)
//
// Packing and tax are tracked separately and are NOT folded into MRP.
export type Pricing = {
  fc: number;
  ptrMargin: number;
  ppp: number;
  sheroMargin: number;
  mrp: number;
  packing: number;
};

export const SHERO_MARGIN_MULT = 1.6;

export function computePricing(fc: number, packing = 0): Pricing {
  const f = Number(fc) || 0;
  const ptrMargin = f * 2;
  const ppp = f + ptrMargin; // = f * 3
  const sheroMargin = f * SHERO_MARGIN_MULT; // = f * 1.6
  const mrp = ppp + sheroMargin; // = f * 4.6
  return { fc: f, ptrMargin, ppp, sheroMargin, mrp, packing: Number(packing) || 0 };
}
