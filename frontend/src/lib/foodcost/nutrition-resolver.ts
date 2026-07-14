import type {
  Category,
  Ingredient,
  NutritionResult,
  Prep,
  Product,
  RecipeItem,
  RecipeVersion,
  Unit,
} from "@/lib/foodcost/types";

type RecipeRow = {
  id: string;
  product_id?: string | null;
  category_id?: string | null;
  prep_id?: string | null;
  current_version_id?: string | null;
};

type IngredientUsage = { ing: Ingredient; via: string };
type SourceKind = "product" | "category" | "none";
type BaseSummary = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  totalG: number;
  slotG: number;
  animal: boolean;
  dairy: boolean;
};
type PrepPerGram = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  animal: boolean;
  dairy: boolean;
};

export type NutritionContext = ReturnType<typeof createNutritionContext>;

export function createNutritionContext({
  ingredients,
  preps,
  recipes,
  versions,
  items,
  units,
  vegetableIngredients,
}: {
  ingredients: Ingredient[];
  preps: Prep[];
  recipes: RecipeRow[];
  versions: RecipeVersion[];
  items: RecipeItem[];
  units: Unit[];
  vegetableIngredients?: Ingredient[];
}) {
  const ingredientById = new Map(ingredients.map((ing) => [ing.id, ing] as const));
  const prepById = new Map(preps.map((prep) => [prep.id, prep] as const));
  const recipeByProduct = new Map<string, RecipeRow>();
  const recipeByCategory = new Map<string, RecipeRow>();
  const recipeByPrep = new Map<string, RecipeRow>();
  const versionsByRecipe = new Map<string, RecipeVersion[]>();
  const itemsByVersion = new Map<string, RecipeItem[]>();
  const unitCodeById = new Map(units.map((unit) => [unit.id, unit.code] as const));
  const prepNutritionCache = new Map<string, PrepPerGram | null>();
  const versionBaseCache = new Map<string, BaseSummary | null>();

  for (const recipe of recipes) {
    if (recipe.product_id) recipeByProduct.set(recipe.product_id, recipe);
    if (recipe.category_id) recipeByCategory.set(recipe.category_id, recipe);
    if (recipe.prep_id) recipeByPrep.set(recipe.prep_id, recipe);
  }

  for (const version of versions) {
    const list = versionsByRecipe.get(version.recipe_id) ?? [];
    list.push(version);
    versionsByRecipe.set(version.recipe_id, list);
  }

  for (const item of items) {
    const list = itemsByVersion.get(item.version_id) ?? [];
    list.push(item);
    itemsByVersion.set(item.version_id, list);
  }

  return {
    ingredientById,
    prepById,
    recipeByProduct,
    recipeByCategory,
    recipeByPrep,
    versionsByRecipe,
    itemsByVersion,
    unitCodeById,
    vegetableIngredients:
      vegetableIngredients ??
      ingredients.filter((ing) => String(ing.category).toLowerCase() === "vegetable"),
    prepNutritionCache,
    versionBaseCache,
  };
}

export function hasMeaningfulNutrition(nutrition: NutritionResult | null | undefined) {
  if (!nutrition) return false;
  const base = nutrition.base_per_100;
  const baseTotal =
    Number(base.kcal) +
    Number(base.protein) +
    Number(base.carbs) +
    Number(base.fat) +
    Number(base.fibre);
  if (baseTotal > 0) return true;
  return nutrition.with_veg.some(
    (veg) =>
      Number(veg.kcal) +
        Number(veg.protein) +
        Number(veg.carbs) +
        Number(veg.fat) +
        Number(veg.fibre) >
      0,
  );
}

export function resolveProductNutrition(
  context: NutritionContext,
  product: Product,
  category: Category | null | undefined,
): { nutrition: NutritionResult | null; source: SourceKind } {
  const vegCandidates = getProductVegCandidates(context, product);

  const productRecipe = context.recipeByProduct.get(product.id);
  if (productRecipe) {
    const nutrition = computeRecipeNutrition(context, productRecipe, {
      vegSlotQty: product.veg_qty_override ?? category?.veg_slot_qty ?? null,
      vegSlotUnitId: category?.veg_slot_unit_id ?? null,
      vegCandidates,
      slotEnabled: product.veg_mode !== "none",
    });
    if (hasMeaningfulNutrition(nutrition)) return { nutrition, source: "product" };
  }

  if (category) {
    const categoryRecipe = context.recipeByCategory.get(category.id);
    if (categoryRecipe) {
      const nutrition = computeRecipeNutrition(context, categoryRecipe, {
        vegSlotQty: product.veg_qty_override ?? category.veg_slot_qty ?? null,
        vegSlotUnitId: category.veg_slot_unit_id ?? null,
        vegCandidates,
        slotEnabled: product.veg_mode !== "none",
      });
      if (hasMeaningfulNutrition(nutrition)) return { nutrition, source: "category" };
    }
  }

  return { nutrition: null, source: "none" };
}

export function resolveProductIngredients(
  context: NutritionContext,
  product: Product,
  category: Category | null | undefined,
) {
  const productRecipe = context.recipeByProduct.get(product.id);
  const categoryRecipe = category ? context.recipeByCategory.get(category.id) : undefined;
  const productIngredients = productRecipe
    ? collectRecipeIngredients(context, productRecipe, "Product CRC")
    : [];
  const categoryIngredients = categoryRecipe
    ? collectRecipeIngredients(context, categoryRecipe, "Category CRC")
    : [];
  const selectedVegs = (product.veg_ingredient_ids ?? [])
    .map((id) => context.ingredientById.get(id))
    .filter((ing): ing is Ingredient => Boolean(ing))
    .map((ing) => ({ ing, via: "Veg slot" }));

  if (productIngredients.length > 0) {
    return {
      source: "product" as const,
      hasRecipeGap: false,
      ingredients: mergeIngredientUsage(productIngredients, selectedVegs),
    };
  }

  if (categoryIngredients.length > 0) {
    return {
      source: "category" as const,
      hasRecipeGap: false,
      ingredients: mergeIngredientUsage(categoryIngredients, selectedVegs),
    };
  }

  return {
    source: "none" as const,
    hasRecipeGap: true,
    ingredients: mergeIngredientUsage([], selectedVegs),
  };
}

function mergeIngredientUsage(primary: IngredientUsage[], extra: IngredientUsage[]) {
  const merged = new Map<string, IngredientUsage>();
  for (const row of [...primary, ...extra]) {
    if (!merged.has(row.ing.id)) merged.set(row.ing.id, row);
  }
  return Array.from(merged.values());
}

function collectRecipeIngredients(context: NutritionContext, recipe: RecipeRow, via: string) {
  const version = pickVersion(context, recipe);
  if (!version) return [];

  const acc = new Map<string, IngredientUsage>();
  const visit = (versionId: string, label: string, seenPreps: Set<string>) => {
    for (const item of context.itemsByVersion.get(versionId) ?? []) {
      if (item.is_veg_slot) continue;
      if (item.ingredient_id) {
        const ing = context.ingredientById.get(item.ingredient_id);
        if (!ing) continue;
        if (!acc.has(ing.id)) acc.set(ing.id, { ing, via: label });
        continue;
      }

      if (!item.prep_id || seenPreps.has(item.prep_id)) continue;
      seenPreps.add(item.prep_id);
      const prepRecipe = context.recipeByPrep.get(item.prep_id);
      const prepName = context.prepById.get(item.prep_id)?.name ?? "prep";
      const prepVersion = prepRecipe ? pickVersion(context, prepRecipe) : null;
      if (prepVersion) visit(prepVersion.id, `${label} → ${prepName}`, seenPreps);
    }
  };

  visit(version.id, via, new Set<string>());
  return Array.from(acc.values());
}

function computeRecipeNutrition(
  context: NutritionContext,
  recipe: RecipeRow,
  options: {
    vegSlotQty?: number | null;
    vegSlotUnitId?: string | null;
    vegCandidates?: Ingredient[];
    slotEnabled?: boolean;
  },
) {
  const version = pickVersion(context, recipe);
  if (!version) return null;

  const summary = getVersionBaseSummary(context, version.id, new Set<string>());
  if (!summary) return null;

  let slotG = summary.slotG;
  if (!slotG && options.slotEnabled && Number(options.vegSlotQty ?? 0) > 0) {
    const unitCode = options.vegSlotUnitId
      ? (context.unitCodeById.get(options.vegSlotUnitId) ?? "g")
      : "g";
    slotG = toBase(Number(options.vegSlotQty), unitCode) * 1000;
  }

  const explicitYield = Number(version.yield_qty ?? 0) > 0;
  const yieldUnit = version.yield_unit_id
    ? (context.unitCodeById.get(version.yield_unit_id) ?? "kg")
    : "kg";
  const wastageFactor = 1 - Number(version.wastage_pct ?? 0) / 100;
  const yieldG = explicitYield
    ? toBase(Number(version.yield_qty), yieldUnit) * 1000 * wastageFactor
    : (summary.totalG + (options.slotEnabled ? slotG : 0)) * wastageFactor;

  if (yieldG <= 0) return null;

  const vegCandidates = options.slotEnabled ? (options.vegCandidates ?? []) : [];
  return {
    yield_g: yieldG,
    veg_slot_g: slotG,
    base_per_100: {
      kcal: (summary.kcal / yieldG) * 100,
      protein: (summary.protein / yieldG) * 100,
      carbs: (summary.carbs / yieldG) * 100,
      fat: (summary.fat / yieldG) * 100,
      fibre: (summary.fibre / yieldG) * 100,
    },
    with_veg: vegCandidates.map((veg) => ({
      id: veg.id,
      name: veg.name,
      kcal: ((summary.kcal + (slotG * Number(veg.kcal_per_100 ?? 0)) / 100) / yieldG) * 100,
      protein:
        ((summary.protein + (slotG * Number(veg.protein_g_per_100 ?? 0)) / 100) / yieldG) * 100,
      carbs: ((summary.carbs + (slotG * Number(veg.carbs_g_per_100 ?? 0)) / 100) / yieldG) * 100,
      fat: ((summary.fat + (slotG * Number(veg.fat_g_per_100 ?? 0)) / 100) / yieldG) * 100,
      fibre: ((summary.fibre + (slotG * Number(veg.fibre_g_per_100 ?? 0)) / 100) / yieldG) * 100,
    })),
    is_vegan: !summary.animal && !summary.dairy,
    is_vegetarian: !summary.animal,
    has_dairy: summary.dairy,
  } satisfies NutritionResult;
}

function getVersionBaseSummary(
  context: NutritionContext,
  versionId: string,
  seenPreps: Set<string>,
): BaseSummary | null {
  if (context.versionBaseCache.has(versionId))
    return context.versionBaseCache.get(versionId) ?? null;

  const summary: BaseSummary = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    totalG: 0,
    slotG: 0,
    animal: false,
    dairy: false,
  };

  for (const item of context.itemsByVersion.get(versionId) ?? []) {
    const unitCode = context.unitCodeById.get(item.unit_id) ?? "g";
    const grams = toBase(Number(item.qty ?? 0), unitCode) * 1000;

    if (item.is_veg_slot) {
      summary.slotG += grams;
      continue;
    }

    summary.totalG += grams;

    if (item.ingredient_id) {
      const ing = context.ingredientById.get(item.ingredient_id);
      if (!ing) continue;
      summary.kcal += (grams * Number(ing.kcal_per_100 ?? 0)) / 100;
      summary.protein += (grams * Number(ing.protein_g_per_100 ?? 0)) / 100;
      summary.carbs += (grams * Number(ing.carbs_g_per_100 ?? 0)) / 100;
      summary.fat += (grams * Number(ing.fat_g_per_100 ?? 0)) / 100;
      summary.fibre += (grams * Number(ing.fibre_g_per_100 ?? 0)) / 100;
      if (Boolean(ing.is_animal_origin) && grams > 0) summary.animal = true;
      if (Boolean(ing.is_dairy) && grams > 0) summary.dairy = true;
      continue;
    }

    if (!item.prep_id || seenPreps.has(item.prep_id)) continue;
    seenPreps.add(item.prep_id);
    const sub = getPrepPerGram(context, item.prep_id, seenPreps);
    seenPreps.delete(item.prep_id);
    if (!sub) continue;
    summary.kcal += grams * sub.kcal;
    summary.protein += grams * sub.protein;
    summary.carbs += grams * sub.carbs;
    summary.fat += grams * sub.fat;
    summary.fibre += grams * sub.fibre;
    if (sub.animal) summary.animal = true;
    if (sub.dairy) summary.dairy = true;
  }

  context.versionBaseCache.set(versionId, summary);
  return summary;
}

function getPrepPerGram(
  context: NutritionContext,
  prepId: string,
  seenPreps: Set<string>,
): PrepPerGram | null {
  if (context.prepNutritionCache.has(prepId)) return context.prepNutritionCache.get(prepId) ?? null;

  const prepRecipe = context.recipeByPrep.get(prepId);
  const version = prepRecipe ? pickVersion(context, prepRecipe) : null;
  if (!version) {
    context.prepNutritionCache.set(prepId, null);
    return null;
  }

  const summary = getVersionBaseSummary(context, version.id, seenPreps);
  if (!summary) {
    context.prepNutritionCache.set(prepId, null);
    return null;
  }

  const prepBaseUnitId = context.prepById.get(prepId)?.base_unit_id;
  const yieldUnit = version.yield_unit_id
    ? (context.unitCodeById.get(version.yield_unit_id) ?? "kg")
    : prepBaseUnitId
      ? (context.unitCodeById.get(prepBaseUnitId) ?? "kg")
      : "kg";
  const explicitYield = Number(version.yield_qty ?? 0) > 0;
  const wastageFactor = 1 - Number(version.wastage_pct ?? 0) / 100;
  const yieldG = explicitYield
    ? toBase(Number(version.yield_qty), yieldUnit) * 1000 * wastageFactor
    : summary.totalG * wastageFactor;

  if (yieldG <= 0) {
    context.prepNutritionCache.set(prepId, null);
    return null;
  }

  const result = {
    kcal: summary.kcal / yieldG,
    protein: summary.protein / yieldG,
    carbs: summary.carbs / yieldG,
    fat: summary.fat / yieldG,
    fibre: summary.fibre / yieldG,
    animal: summary.animal,
    dairy: summary.dairy,
  } satisfies PrepPerGram;

  context.prepNutritionCache.set(prepId, result);
  return result;
}

function pickVersion(context: NutritionContext, recipe: RecipeRow | null | undefined) {
  if (!recipe) return null;
  const versions = (context.versionsByRecipe.get(recipe.id) ?? []).slice();
  versions.sort((a, b) => {
    const aCurrent = a.id === recipe.current_version_id ? 1 : 0;
    const bCurrent = b.id === recipe.current_version_id ? 1 : 0;
    return bCurrent - aCurrent || b.version_no - a.version_no;
  });
  return versions[0] ?? null;
}

function getProductVegCandidates(context: NutritionContext, product: Product) {
  if (product.veg_mode === "none") return [];

  const selected = (product.veg_ingredient_ids ?? [])
    .map((id) => context.ingredientById.get(id))
    .filter((ing): ing is Ingredient => Boolean(ing));

  if (selected.length > 0) return selected;
  return context.vegetableIngredients;
}

function toBase(qty: number, unitCode: string) {
  switch (unitCode) {
    case "g":
    case "ml":
      return qty / 1000;
    case "kg":
    case "l":
    case "pcs":
    case "packet":
    case "lump":
      return qty;
    case "tbsp":
      return (qty * 15) / 1000;
    case "tsp":
      return (qty * 5) / 1000;
    case "cup":
      return (qty * 240) / 1000;
    case "pinch":
      return (qty * 0.3) / 1000;
    default:
      return qty;
  }
}
