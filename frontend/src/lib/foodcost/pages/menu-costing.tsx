import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFoodcostCountry, COUNTRY_LABEL } from "@/lib/foodcost/country";
import { IngredientsPage } from "@/lib/foodcost/pages/ingredients";
import { PrepsPage } from "@/lib/foodcost/pages/preps";
import { MenuPage } from "@/lib/foodcost/pages/menu";
import { VegUsagePage } from "@/lib/foodcost/pages/veg-usage";

export function MenuCostingPage() {
  const country = useFoodcostCountry();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">
          ALC Menu &amp; Costing{" "}
          {country && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — {COUNTRY_LABEL[country]}
            </span>
          )}
        </h1>
        <p className="text-xs text-muted-foreground">Ingredients, pre-preps and menu cards.</p>
      </div>
      <Tabs defaultValue="ingredients">
        <TabsList>
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="preps">Pre-Preps</TabsTrigger>
          <TabsTrigger value="menu">Menu Card</TabsTrigger>
          <TabsTrigger value="veg-usage">Veg Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="ingredients" className="mt-4">
          <IngredientsPage />
        </TabsContent>
        <TabsContent value="preps" className="mt-4">
          <PrepsPage />
        </TabsContent>
        <TabsContent value="menu" className="mt-4">
          <MenuPage />
        </TabsContent>
        <TabsContent value="veg-usage" className="mt-4">
          <VegUsagePage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
