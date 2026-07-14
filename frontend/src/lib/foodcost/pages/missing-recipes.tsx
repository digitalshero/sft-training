import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  useFoodcostCountry,
  COUNTRY_LABEL,
  countryField,
  countryCurrency,
} from "@/lib/foodcost/country";

type Cat = { id: string; name: string; brand_id: string; crc_recipe_id: string | null };
type Brand = { id: string; name: string };
type Product = { id: string; name: string; code: string; category_id: string; brand_id: string };
type RecipeRow = { id: string; product_id: string | null; status: string };

export function MissingRecipesPage() {
  const country = useFoodcostCountry();
  const navigate = useNavigate();
  const f = country ? countryField(country) : "active_in";
  const ccy = country ? countryCurrency(country) : "inr";
  const [cats, setCats] = useState<Cat[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [costMap, setCostMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [brandF, setBrandF] = useState("all");
  const [catF, setCatF] = useState("all");

  async function load() {
    if (!country) return;
    setLoading(true);
    const [c, b, p, r] = await Promise.all([
      api.get("/foodcost/categories", { params: { country: country ?? undefined } }).order("name"),
      api.get("/foodcost/brands", { params: { country: country ?? undefined } }).order("name"),
      api.get("/foodcost/products", { params: { country: country ?? undefined } }).order("name"),
      api
        .get("/foodcost/recipes", { params: { country: country ?? undefined } })
        .not("product_id", "is", null),
    ]);
    const prods = (p.data ?? []) as Product[];
    setCats((c.data ?? []) as Cat[]);
    setBrands((b.data ?? []) as Brand[]);
    setProducts(prods);
    setRecipes((r.data ?? []) as RecipeRow[]);

    const costs = await Promise.all(
      prods.map((pr) =>
        api.post("/foodcost/rpc/fc-product-cost", { _product_id: pr.id, _currency: ccy }),
      ),
    );
    const cm = new Map<string, number>();
    prods.forEach((pr, i) => cm.set(pr.id, Number(costs[i]?.data ?? 0)));
    setCostMap(cm);
    setLoading(false);
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [country, f, ccy]);

  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats]);
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const activeCatIds = useMemo(() => new Set(cats.map((c) => c.id)), [cats]);
  const recipeByProduct = useMemo(() => {
    const m = new Map<string, RecipeRow>();
    recipes.forEach((r) => {
      if (r.product_id) m.set(r.product_id, r);
    });
    return m;
  }, [recipes]);

  // Tab 1: categories without CRC
  const missingCats = useMemo(
    () =>
      cats
        .filter((c) => !c.crc_recipe_id)
        .filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q.toLowerCase()) ||
            (brandName.get(c.brand_id) ?? "").toLowerCase().includes(q.toLowerCase()),
        ),
    [cats, q, brandName],
  );

  // Tab 2: non-CRC products = product whose category has no crc_recipe_id
  const nonCrcProducts = useMemo(() => {
    const ql = q.toLowerCase();
    return products.filter((p) => {
      if (!activeCatIds.has(p.category_id)) return false;
      const cat = catMap.get(p.category_id);
      if (!cat || cat.crc_recipe_id) return false;
      if (brandF !== "all" && p.brand_id !== brandF) return false;
      if (catF !== "all" && p.category_id !== catF) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(ql) ||
        p.code.toLowerCase().includes(ql) ||
        (catName.get(p.category_id) ?? "").toLowerCase().includes(ql) ||
        (brandName.get(p.brand_id) ?? "").toLowerCase().includes(ql)
      );
    });
  }, [products, catMap, brandF, catF, q, catName, brandName]);

  const nonCrcCatsForBrand = useMemo(() => {
    const list = cats.filter((c) => !c.crc_recipe_id);
    return brandF === "all" ? list : list.filter((c) => c.brand_id === brandF);
  }, [cats, brandF]);

  const nonCrcMissingRecipeCount = useMemo(
    () => nonCrcProducts.filter((p) => !recipeByProduct.has(p.id)).length,
    [nonCrcProducts, recipeByProduct],
  );

  // Tab 3: zero-cost products
  const missingProducts = useMemo(
    () =>
      products
        .filter((p) => activeCatIds.has(p.category_id) && (costMap.get(p.id) ?? 0) <= 0)
        .filter(
          (p) =>
            !q ||
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.code.toLowerCase().includes(q.toLowerCase()) ||
            (catName.get(p.category_id) ?? "").toLowerCase().includes(q.toLowerCase()) ||
            (brandName.get(p.brand_id) ?? "").toLowerCase().includes(q.toLowerCase()),
        ),
    [products, costMap, q, catName, brandName],
  );

  async function createRecipeForProduct(productId: string) {
    const c = (ccy as string).toLowerCase() as "inr" | "usd";
    const existing = await api
      .get("/foodcost/recipes", { params: { country: country ?? undefined } })
      .maybeSingle();
    if (existing.error) {
      toast.error(existing.error.message);
      return;
    }
    if (existing.data) {
      navigate({ to: "/foodcost/recipes/$recipeId", params: { recipeId: existing.data.id } });
      return;
    }
    const rec = await api
      .post("/foodcost/recipes", { product_id: productId, status: "draft" })
      .then((r) => r.data)
      .select("id")
      .single();
    if (rec.error || !rec.data) {
      toast.error(rec.error?.message ?? "Could not create recipe");
      return;
    }
    const ver = await api
      .post("/foodcost/recipe-versions", {
        recipe_id: rec.data.id,
        version_no: 1,
        currency: c,
        status: "draft",
      })
      .then((r) => r.data)
      .select("id")
      .single();
    if (ver.error || !ver.data) {
      toast.error(ver.error.message);
      return;
    }
    await api
      .patch(`/foodcost/recipes/${rec.data.id}`, { current_version_id: ver.data.id })
      .then((r) => r.data);
    navigate({ to: "/foodcost/recipes/$recipeId", params: { recipeId: rec.data.id } });
  }

  if (!country) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Missing Recipes — {COUNTRY_LABEL[country]}</h1>
        <p className="text-sm text-muted-foreground">
          Track categories and products that still need a recipe linked in {ccy.toUpperCase()}.
        </p>
      </div>

      <Input
        placeholder="Search by name, code, category or brand…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      <Tabs defaultValue="cats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cats">
            Categories without CRC{" "}
            <Badge variant="secondary" className="ml-2">
              {missingCats.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="noncrc">
            Non-CRC Products{" "}
            <Badge variant="secondary" className="ml-2">
              {nonCrcMissingRecipeCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="zero">
            Zero-cost Products{" "}
            <Badge variant="secondary" className="ml-2">
              {missingProducts.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cats">
          <Card>
            <CardHeader>
              <CardTitle>Categories without CRC recipe</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingCats.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{brandName.get(c.brand_id) ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            to="/foodcost/categories/$id/crc"
                            params={{ id: c.id }}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            Link CRC recipe
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                    {missingCats.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-sm text-muted-foreground"
                        >
                          All categories have a CRC recipe 🎉
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="noncrc">
          <Card>
            <CardHeader>
              <CardTitle>Non-CRC Products</CardTitle>
              <p className="text-sm text-muted-foreground">
                Products whose category has no CRC recipe — each needs its own product-level recipe
                (e.g. Dosa).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Select
                  value={brandF}
                  onValueChange={(v) => {
                    setBrandF(v);
                    setCatF("all");
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All brands</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={catF} onValueChange={setCatF}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All non-CRC categories</SelectItem>
                    {nonCrcCatsForBrand.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Recipe</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nonCrcProducts.map((p) => {
                      const r = recipeByProduct.get(p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.code}</TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{catName.get(p.category_id) ?? "—"}</TableCell>
                          <TableCell>{brandName.get(p.brand_id) ?? "—"}</TableCell>
                          <TableCell>
                            {r ? (
                              <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                                {r.status}
                              </Badge>
                            ) : (
                              <Badge variant="outline">None</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {r ? (
                              <Link
                                to="/foodcost/recipes/$recipeId"
                                params={{ recipeId: r.id }}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                Open recipe →
                              </Link>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => createRecipeForProduct(p.id)}
                              >
                                Add recipe
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {nonCrcProducts.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground"
                        >
                          No non-CRC products match these filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zero">
          <Card>
            <CardHeader>
              <CardTitle>Products with zero cost</CardTitle>
              <p className="text-sm text-muted-foreground">
                Computed cost is 0 — either no product recipe and no category CRC, or the recipe has
                no priced items.
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Brand</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingProducts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.code}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{catName.get(p.category_id) ?? "—"}</TableCell>
                        <TableCell>{brandName.get(p.brand_id) ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {missingProducts.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-sm text-muted-foreground"
                        >
                          Every product has a cost 🎉
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
