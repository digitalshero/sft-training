import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFoodcostCountry, COUNTRY_LABEL } from "@/lib/foodcost/country";
import { CategoriesPage } from "@/lib/foodcost/pages/categories";
import { ProductsPage } from "@/lib/foodcost/pages/products";
import { PackingContainersPage } from "@/lib/foodcost/pages/packing-containers";

export function BrandMasterPage() {
  const country = useFoodcostCountry();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">
          ALC Brand Master{" "}
          {country && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — {COUNTRY_LABEL[country]}
            </span>
          )}
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage categories, products and packing in one place.
        </p>
      </div>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="packing">Packing</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-4">
          <CategoriesPage />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <ProductsPage />
        </TabsContent>
        <TabsContent value="packing" className="mt-4">
          <PackingContainersPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
