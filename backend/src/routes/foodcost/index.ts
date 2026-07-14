import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requirePermission } from '../../middleware/auth';

export const foodcostRoutes = Router();
foodcostRoutes.use(requireAuth);

// Helper: country-scope filter ('in' | 'us' | undefined)
function countryFilter(country?: string) {
  if (country === 'in') return { activeIn: true };
  if (country === 'us') return { activeUs: true };
  return {};
}

// ── Units ─────────────────────────────────────────────────────────────────────

foodcostRoutes.get('/units', requirePermission('foodcost_dashboard'), async (_req, res, next) => {
  try {
    res.json(await prisma.fcUnit.findMany({ orderBy: { name: 'asc' } }));
  } catch (e) { next(e); }
});

// ── Brands ────────────────────────────────────────────────────────────────────

foodcostRoutes.get('/brands', async (req, res, next) => {
  try {
    const { country } = req.query as { country?: string };
    res.json(await prisma.fcBrand.findMany({ where: countryFilter(country), orderBy: { name: 'asc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.post('/brands', async (req, res, next) => {
  try {
    const brand = await prisma.fcBrand.create({ data: req.body });
    res.status(201).json(brand);
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/brands/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcBrand.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.delete('/brands/:id', async (req, res, next) => {
  try {
    await prisma.fcBrand.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Categories ────────────────────────────────────────────────────────────────

foodcostRoutes.get('/categories', async (req, res, next) => {
  try {
    const { country, brandId } = req.query as { country?: string; brandId?: string };
    res.json(await prisma.fcCategory.findMany({
      where:   { ...countryFilter(country), ...(brandId ? { brandId } : {}) },
      orderBy: { name: 'asc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.post('/categories', async (req, res, next) => {
  try {
    res.status(201).json(await prisma.fcCategory.create({ data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/categories/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcCategory.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.delete('/categories/:id', async (req, res, next) => {
  try {
    await prisma.fcCategory.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Ingredients ───────────────────────────────────────────────────────────────

foodcostRoutes.get('/ingredients', async (req, res, next) => {
  try {
    const { country } = req.query as { country?: string };
    res.json(await prisma.fcIngredient.findMany({ where: countryFilter(country), orderBy: { name: 'asc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.post('/ingredients', async (req, res, next) => {
  try {
    res.status(201).json(await prisma.fcIngredient.create({ data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/ingredients/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.fcIngredient.findUniqueOrThrow({ where: { id: req.params.id } });
    const data = req.body as Record<string, unknown>;

    // Record price history if price changed - use interactive transaction to avoid tuple spread issues
    const updated = await prisma.$transaction(async (tx) => {
      if (data.price_inr !== undefined && data.price_inr !== existing.priceInr) {
        await tx.fcIngredientPriceHistory.create({
          data: { ingredientId: existing.id, currency: 'inr', oldPrice: existing.priceInr, newPrice: data.price_inr as number },
        });
      }
      if (data.price_usd !== undefined && data.price_usd !== existing.priceUsd) {
        await tx.fcIngredientPriceHistory.create({
          data: { ingredientId: existing.id, currency: 'usd', oldPrice: existing.priceUsd, newPrice: data.price_usd as number },
        });
      }
      return tx.fcIngredient.update({ where: { id: req.params.id }, data: req.body });
    });
    res.json(updated);
  } catch (e) { next(e); }
});

foodcostRoutes.delete('/ingredients/:id', async (req, res, next) => {
  try {
    await prisma.fcIngredient.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Packing Containers ────────────────────────────────────────────────────────

foodcostRoutes.get('/packing-containers', async (req, res, next) => {
  try {
    const { country } = req.query as { country?: string };
    res.json(await prisma.fcPackingContainer.findMany({ where: countryFilter(country), orderBy: { name: 'asc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.post('/packing-containers', async (req, res, next) => {
  try {
    res.status(201).json(await prisma.fcPackingContainer.create({ data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/packing-containers/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcPackingContainer.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.delete('/packing-containers/:id', async (req, res, next) => {
  try {
    await prisma.fcPackingContainer.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Products ──────────────────────────────────────────────────────────────────

foodcostRoutes.get('/products', async (req, res, next) => {
  try {
    const { country, brandId, categoryId } = req.query as { country?: string; brandId?: string; categoryId?: string };
    res.json(await prisma.fcProduct.findMany({
      where: { ...countryFilter(country), ...(brandId ? { brandId } : {}), ...(categoryId ? { categoryId } : {}) },
      include: { brand: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.post('/products', async (req, res, next) => {
  try {
    res.status(201).json(await prisma.fcProduct.create({ data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/products/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcProduct.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.delete('/products/:id', async (req, res, next) => {
  try {
    await prisma.fcProduct.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Preps ─────────────────────────────────────────────────────────────────────

foodcostRoutes.get('/preps', async (req, res, next) => {
  try {
    const { country, brandId } = req.query as { country?: string; brandId?: string };
    res.json(await prisma.fcPrep.findMany({
      where: { ...countryFilter(country), ...(brandId ? { brandId } : {}) },
      orderBy: { name: 'asc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/preps/:id', async (req, res, next) => {
  try {
    const prep = await prisma.fcPrep.findUniqueOrThrow({ where: { id: req.params.id } });
    const versions = await prisma.fcRecipeVersion.findMany({
      where:   { recipe: { prepId: prep.id } },
      include: { items: true },
      orderBy: { versionNo: 'desc' },
    });
    res.json({ prep, versions });
  } catch (e) { next(e); }
});

foodcostRoutes.post('/preps', async (req, res, next) => {
  try {
    res.status(201).json(await prisma.fcPrep.create({ data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/preps/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcPrep.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

// ── Recipes & Versions ────────────────────────────────────────────────────────

foodcostRoutes.get('/recipes', async (_req, res, next) => {
  try {
    res.json(await prisma.fcRecipe.findMany({ orderBy: { createdAt: 'desc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/recipes/:recipeId', async (req, res, next) => {
  try {
    const recipe = await prisma.fcRecipe.findUniqueOrThrow({
      where:   { id: req.params.recipeId },
      include: { versions: { include: { items: true }, orderBy: { versionNo: 'desc' } } },
    });
    res.json(recipe);
  } catch (e) { next(e); }
});

foodcostRoutes.post('/recipes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recipe = await prisma.fcRecipe.create({ data: { ...req.body } });
    res.status(201).json(recipe);
  } catch (e) { next(e); }
});

foodcostRoutes.get('/recipe-versions', async (_req, res, next) => {
  try {
    res.json(await prisma.fcRecipeVersion.findMany({ orderBy: { createdAt: 'desc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.post('/recipe-versions', async (req, res, next) => {
  try {
    const version = await prisma.fcRecipeVersion.create({ data: req.body });
    res.status(201).json(version);
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/recipe-versions/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcRecipeVersion.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.post('/recipe-items', async (req, res, next) => {
  try {
    res.status(201).json(await prisma.fcRecipeItem.create({ data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/recipe-items/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcRecipeItem.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.delete('/recipe-items/:id', async (req, res, next) => {
  try {
    await prisma.fcRecipeItem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Price Lists ───────────────────────────────────────────────────────────────

foodcostRoutes.get('/price-lists', async (req, res, next) => {
  try {
    const { currency } = req.query as { currency?: string };
    res.json(await prisma.fcPriceList.findMany({
      where:   currency ? { currency: currency as 'inr' | 'usd' } : {},
      orderBy: { createdAt: 'desc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/price-lists/:id', async (req, res, next) => {
  try {
    const pl = await prisma.fcPriceList.findUniqueOrThrow({
      where:   { id: req.params.id },
      include: { items: { orderBy: { position: 'asc' } }, logs: { orderBy: { createdAt: 'desc' } } },
    });
    res.json(pl);
  } catch (e) { next(e); }
});

foodcostRoutes.post('/price-lists', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await prisma.fcPriceList.create({ data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/price-lists/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcPriceList.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.delete('/price-lists/:id', async (req, res, next) => {
  try {
    await prisma.fcPriceList.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

foodcostRoutes.post('/price-list-items', async (req, res, next) => {
  try {
    res.status(201).json(await prisma.fcPriceListItem.create({ data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.patch('/price-list-items/:id', async (req, res, next) => {
  try {
    res.json(await prisma.fcPriceListItem.update({ where: { id: req.params.id }, data: req.body }));
  } catch (e) { next(e); }
});

foodcostRoutes.delete('/price-list-items/:id', async (req, res, next) => {
  try {
    await prisma.fcPriceListItem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Approval Log ──────────────────────────────────────────────────────────────

foodcostRoutes.get('/recipes/:recipeId/approval-log', async (req, res, next) => {
  try {
    res.json(await prisma.fcApprovalLog.findMany({
      where:   { recipeId: req.params.recipeId },
      orderBy: { createdAt: 'desc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.post('/recipes/:recipeId/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from_status, to_status, role, comment } = req.body;
    await prisma.fcApprovalLog.create({
      data: { recipeId: req.params.recipeId, fromStatus: from_status, toStatus: to_status, role, comment },
    });
    await prisma.fcRecipe.update({ where: { id: req.params.recipeId }, data: { status: to_status } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Ingredient Price History ──────────────────────────────────────────────────

foodcostRoutes.get('/ingredient-price-history', async (req, res, next) => {
  try {
    const { limit = '100' } = req.query as { limit?: string };
    res.json(await prisma.fcIngredientPriceHistory.findMany({
      orderBy: { changedAt: 'desc' },
      take: parseInt(limit, 10),
    }));
  } catch (e) { next(e); }
});

// ── Legacy fc_ prefixed routes ────────────────────────────────────────────────

foodcostRoutes.get('/fc-brands', async (req, res, next) => {
  try {
    const { country } = req.query as { country?: string };
    res.json(await prisma.fcBrand.findMany({ where: countryFilter(country), orderBy: { name: 'asc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/fc-categories', async (req, res, next) => {
  try {
    const { country, brandId } = req.query as { country?: string; brandId?: string };
    res.json(await prisma.fcCategory.findMany({
      where: { ...countryFilter(country), ...(brandId ? { brandId } : {}) },
      orderBy: { name: 'asc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/fc-ingredients', async (req, res, next) => {
  try {
    const { country } = req.query as { country?: string };
    res.json(await prisma.fcIngredient.findMany({ where: countryFilter(country), orderBy: { name: 'asc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/fc-products', async (req, res, next) => {
  try {
    const { country, brandId, categoryId } = req.query as { country?: string; brandId?: string; categoryId?: string };
    res.json(await prisma.fcProduct.findMany({
      where: { ...countryFilter(country), ...(brandId ? { brandId } : {}), ...(categoryId ? { categoryId } : {}) },
      orderBy: { name: 'asc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/fc-preps', async (req, res, next) => {
  try {
    const { country, brandId } = req.query as { country?: string; brandId?: string };
    res.json(await prisma.fcPrep.findMany({
      where: { ...countryFilter(country), ...(brandId ? { brandId } : {}) },
      orderBy: { name: 'asc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/fc-packing-containers', async (req, res, next) => {
  try {
    const { country } = req.query as { country?: string };
    res.json(await prisma.fcPackingContainer.findMany({ where: countryFilter(country), orderBy: { name: 'asc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/fc-recipes', async (_req, res, next) => {
  try {
    res.json(await prisma.fcRecipe.findMany({ orderBy: { createdAt: 'desc' } }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/fc-price-lists', async (req, res, next) => {
  try {
    const { currency } = req.query as { currency?: string };
    res.json(await prisma.fcPriceList.findMany({
      where: currency ? { currency: currency as 'inr' | 'usd' } : {},
      orderBy: { createdAt: 'desc' },
    }));
  } catch (e) { next(e); }
});

foodcostRoutes.get('/fc-ingredient-price-history', async (req, res, next) => {
  try {
    const { limit = '100' } = req.query as { limit?: string };
    res.json(await prisma.fcIngredientPriceHistory.findMany({
      orderBy: { changedAt: 'desc' },
      take: parseInt(limit, 10),
    }));
  } catch (e) { next(e); }
});
