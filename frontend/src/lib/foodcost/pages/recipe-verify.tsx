import { FcAuditPage } from "@/lib/foodcost/pages/fc-audit";

// Recipe Verify uses the same per-product card layout as FC Audit
// (Ingredient/Pre-Prep · Qty · Unit · Unit Price · Line Cost · Issues
//  + sub-total → veg slot → packing → PPP → Shero margin → MRP footer).
export function RecipeVerifyPage({ country }: { country: "in" | "us" }) {
  return <FcAuditPage country={country} />;
}
