export type FcStatus = "active" | "inactive";
export type FcCurrency = "inr" | "usd";
export type FcCurrencyMode = "inr" | "usd" | "both";
export type FcIngredientCategory =
  "grocery" | "vegetable" | "spice" | "oil" | "dairy" | "packing" | "other";
export type FcRecipeStatus =
  "draft" | "submitted" | "change_pending_approval" | "approved" | "rejected";
export type FcVersionStatus =
  "draft" | "submitted" | "approved" | "rejected" | "superseded";

export type Brand = {
  id: string;
  name: string;
  code: string;
  code_prefix: string | null;
  description: string | null;
  status: FcStatus;
  active_in: boolean;
  active_us: boolean;
  brand_since: string | null;
  created_at?: string;
};
export type FcPricingMode = "multiplier" | "flat";
export type Category = {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  ppp_multiplier_inr: number;
  mrp_multiplier_inr: number;
  ppp_multiplier_usd: number;
  mrp_multiplier_usd: number;
  ppp_mode: FcPricingMode;
  mrp_mode: FcPricingMode;
  ppp_flat_inr: number;
  mrp_flat_inr: number;
  ppp_flat_usd: number;
  mrp_flat_usd: number;
  ptr_mode?: FcPricingMode;
  ptr_multiplier_inr?: number;
  ptr_multiplier_usd?: number;
  ptr_flat_inr?: number;
  ptr_flat_usd?: number;
  status: FcStatus;
  active_in: boolean;
  active_us: boolean;
  crc_recipe_id?: string | null;
  veg_slot_qty?: number;
  veg_slot_unit_id?: string | null;
  packing_container_id?: string | null;
  serves_min?: number | null;
  serves_max?: number | null;
  hero_image_url?: string | null;
  packing_image_url?: string | null;
  vcr_image_url?: string | null;
  video_url?: string | null;
  colour_note?: string | null;
  consistency_note?: string | null;
  taste_note?: string | null;
};
export type PackingContainer = {
  id: string;
  name: string;
  size_qty: number;
  size_unit_id: string | null;
  price_inr: number;
  price_usd: number;
  status: FcStatus;
  active_in: boolean;
  active_us: boolean;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type FcVegMode = "none" | "single" | "multi" | "mix";
export type Product = {
  id: string;
  brand_id: string;
  category_id: string;
  name: string;
  code: string;
  description: string | null;
  currency_mode: FcCurrencyMode;
  status: FcStatus;
  active_in: boolean;
  active_us: boolean;
  veg_mode?: FcVegMode;
  veg_ingredient_ids?: string[];
  veg_qty_override?: number | null;
  menu_description?: string | null;
  serves_label?: string | null;
  spice_level?: number;
  allergens?: string[];
  menu_position?: number;
  available?: boolean;
};
export type Unit = { id: string; code: string; name: string; kind: string };
export type Ingredient = {
  id: string;
  name: string;
  category: FcIngredientCategory;
  base_unit_id: string;
  price_inr: number;
  price_usd: number;
  status: FcStatus;
  last_updated_at: string;
  last_updated_by: string | null;
  active_in: boolean;
  active_us: boolean;
  kcal_per_100?: number;
  protein_g_per_100?: number;
  carbs_g_per_100?: number;
  fat_g_per_100?: number;
  fibre_g_per_100?: number;
  is_animal_origin?: boolean;
  is_dairy?: boolean;
};

// Nutrition badge helpers (FSSAI/WHO per-100g/ml thresholds)
export type NutriMacro = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
};
export type NutritionResult = {
  yield_g: number;
  veg_slot_g: number;
  base_per_100: NutriMacro;
  with_veg: Array<NutriMacro & { id: string; name: string }>;
  is_vegan: boolean;
  is_vegetarian?: boolean;
  has_dairy?: boolean;
};
export function nutriRange(
  rows: NutriMacro[],
  key: keyof NutriMacro,
): { min: number; max: number } {
  if (!rows.length) return { min: 0, max: 0 };
  const vals = rows.map((r) => Number(r[key] ?? 0));
  return { min: Math.min(...vals), max: Math.max(...vals) };
}
export function fmtRange(min: number, max: number, unit = "g", digits = 1) {
  const a = min.toFixed(digits);
  const b = max.toFixed(digits);
  return a === b ? `${a}${unit}` : `${a}–${b}${unit}`;
}
// Realistic, FDA-style badge logic. Reads the product holistically: per-100g
// macros (already include base + vegetables via the resolver) PLUS the product
// name to suppress impossible combinations (e.g. "Low Calorie" on a fried snack).
export function nutritionBadges(
  per100: NutriMacro,
  isVegan: boolean,
  productName: string = "",
  hasDairy: boolean = false,
): { label: string; tone: string }[] {
  const out: { label: string; tone: string }[] = [];
  const name = productName.toLowerCase();
  const friedOrRich =
    /(fry|fried|ghee|vada|bonda|bajji|pakoda|pakora|samosa|puri|poori|kachori|halwa|ladoo|laddu|mysore pak|jangri|jalebi|murukku|chakli|boondi|payasam|kheer|kesari|sheera|paratha|biryani|pulao|fried rice|cheese|paneer|butter|cream)/.test(
      name,
    );
  const sweet =
    /(halwa|ladoo|laddu|mysore pak|jangri|jalebi|payasam|kheer|kesari|sheera|sweet|jamun|rasgulla|barfi|burfi|peda)/.test(
      name,
    );

  // Vegan only when truly plant-based AND the product carries no dairy (by ingredient flag or name)
  const dairyByName =
    /(ghee|paneer|cheese|butter|cream|curd|yogurt|yoghurt|milk|khoya|mawa)/.test(
      name,
    );
  if (isVegan && !hasDairy && !dairyByName)
    out.push({ label: "Vegan", tone: "bg-emerald-500/15 text-emerald-500" });

  // High Protein: ≥8g/100g and meaningful calorie density
  if (per100.protein >= 8 && per100.kcal >= 60)
    out.push({ label: "High Protein", tone: "bg-blue-500/15 text-blue-500" });

  // High Fibre: ≥5g/100g
  if (per100.fibre >= 5)
    out.push({ label: "High Fibre", tone: "bg-amber-500/15 text-amber-500" });

  // Low Calorie: ≤100 kcal/100g, not fried/rich/sweet, real food (kcal>20)
  if (
    per100.kcal > 20 &&
    per100.kcal <= 100 &&
    per100.fat <= 5 &&
    !friedOrRich &&
    !sweet
  )
    out.push({ label: "Low Calorie", tone: "bg-teal-500/15 text-teal-500" });

  // Low Fat: ≤3g/100g, not fried/rich, real food
  if (per100.fat <= 3 && per100.kcal >= 50 && !friedOrRich)
    out.push({ label: "Low Fat", tone: "bg-violet-500/15 text-violet-500" });

  return out;
}

// Allergen display: for Chettinad cuisine keep only nut-family and dairy allergens.
const NUT_RE = /nut|peanut|cashew|almond|walnut|pistachio|hazelnut|pecan/i;
const DAIRY_RE =
  /dairy|milk|lactose|ghee|butter|cheese|paneer|cream|curd|yog(h)?urt|khoya|mawa|whey|casein/i;
export function filterAllergens(
  allergens: string[] | null | undefined,
): string[] {
  if (!allergens) return [];
  return allergens.filter((a) => NUT_RE.test(a) || DAIRY_RE.test(a));
}
// Derive allergens directly from an ingredient list (names). Returns canonical labels.
export function deriveAllergensFromIngredients(names: string[]): string[] {
  const tags = new Set<string>();
  for (const raw of names) {
    const n = String(raw || "").toLowerCase();
    if (NUT_RE.test(n)) {
      if (/cashew/.test(n)) tags.add("Cashew");
      else if (/peanut/.test(n)) tags.add("Peanut");
      else if (/almond/.test(n)) tags.add("Almond");
      else if (/walnut/.test(n)) tags.add("Walnut");
      else if (/pistachio/.test(n)) tags.add("Pistachio");
      else if (/hazelnut/.test(n)) tags.add("Hazelnut");
      else if (/pecan/.test(n)) tags.add("Pecan");
      else tags.add("Nuts");
    }
    if (DAIRY_RE.test(n)) tags.add("Dairy");
  }
  return Array.from(tags).sort();
}
export type Recipe = {
  id: string;
  product_id: string | null;
  prep_id: string | null;
  status: FcRecipeStatus;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};
export type RecipeVersion = {
  id: string;
  recipe_id: string;
  version_no: number;
  currency: FcCurrency;
  notes: string | null;
  change_summary: string | null;
  status: FcVersionStatus;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  ppp_mode: FcPricingMode | null;
  mrp_mode: FcPricingMode | null;
  ppp_multiplier: number | null;
  mrp_multiplier: number | null;
  ppp_flat: number | null;
  mrp_flat: number | null;
  yield_qty: number | null;
  yield_unit_id: string | null;
  wastage_pct: number;
};
export type RecipeItem = {
  id: string;
  version_id: string;
  position: number;
  ingredient_id: string | null;
  prep_id: string | null;
  qty: number;
  unit_id: string;
  wastage_pct: number;
  notes: string | null;
  is_veg_slot?: boolean;
};

export type FcPrepType =
  | "base"
  | "paste"
  | "extract"
  | "seasoning"
  | "masala_mix"
  | "gravy_base"
  | "boiled_cooked"
  | "fried_roasted"
  | "other";

export type Prep = {
  id: string;
  code: string;
  name: string;
  type: FcPrepType;
  brand_id: string | null;
  category_id: string | null;
  description: string | null;
  cuisine: string | null;
  preparation_notes: string | null;
  storage_notes: string | null;
  shelf_life_days: number | null;
  shelf_life_condition: string | null;
  base_unit_id: string;
  default_batch_size: number | null;
  default_yield_qty: number | null;
  default_yield_unit_id: string | null;
  default_wastage_pct: number;
  currency_mode: FcCurrencyMode;
  status: FcStatus;
  active_in: boolean;
  active_us: boolean;
  created_at?: string;
  updated_at?: string;
};

export const PREP_TYPES: { value: FcPrepType; label: string }[] = [
  { value: "base", label: "Base" },
  { value: "paste", label: "Paste" },
  { value: "extract", label: "Extract" },
  { value: "seasoning", label: "Seasoning" },
  { value: "masala_mix", label: "Masala Mix" },
  { value: "gravy_base", label: "Gravy Base" },
  { value: "boiled_cooked", label: "Boiled / Cooked Base" },
  { value: "fried_roasted", label: "Fried / Roasted Component" },
  { value: "other", label: "Other Prep Component" },
];

export const INGREDIENT_CATEGORIES: {
  value: FcIngredientCategory;
  label: string;
}[] = [
  { value: "grocery", label: "Grocery" },
  { value: "vegetable", label: "Vegetable" },
  { value: "spice", label: "Spice" },
  { value: "oil", label: "Oil" },
  { value: "dairy", label: "Dairy" },
  { value: "packing", label: "Packing" },
  { value: "other", label: "Other" },
];

export const RECIPE_STATUS_LABEL: Record<FcRecipeStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  change_pending_approval: "Change Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const RECIPE_STATUS_TONE: Record<FcRecipeStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/15 text-blue-400",
  change_pending_approval: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export const MULTIPLIER_PRESETS = [1, 1.25, 1.5, 2, 2.5, 3];

/** Convert qty in unit_code to ingredient base-unit qty (same logic as DB view) */
export function toBase(qty: number, unitCode: string): number {
  switch (unitCode) {
    case "g":
      return qty / 1000;
    case "kg":
      return qty;
    case "ml":
      return qty / 1000;
    case "l":
      return qty;
    case "tbsp":
      return (qty * 15) / 1000;
    case "tsp":
      return (qty * 5) / 1000;
    case "cup":
      return (qty * 240) / 1000;
    case "pinch":
      return (qty * 0.3) / 1000;
    case "pcs":
    case "packet":
    case "lump":
      return qty;
    default:
      return qty;
  }
}

export function fmt(
  v: number | null | undefined,
  ccy: FcCurrency,
  digits = 3,
): string {
  if (v == null || isNaN(v)) return "—";
  const sym = ccy === "inr" ? "₹" : "$";
  return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
