import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFoodcostCountry, COUNTRY_LABEL } from "@/lib/foodcost/country";
import { MissingRecipesPage } from "@/lib/foodcost/pages/missing-recipes";
import { FcAuditPage } from "@/lib/foodcost/pages/fc-audit";
import { NutriAuditPage } from "@/lib/foodcost/pages/nutri-audit";
import { RecipeVerifyPage } from "@/lib/foodcost/pages/recipe-verify";

export function AuditPage() {
  const country = useFoodcostCountry() ?? "in";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">
          Audit{" "}
          {country && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — {COUNTRY_LABEL[country]}
            </span>
          )}
        </h1>
        <p className="text-xs text-muted-foreground">
          Cross-check recipes, costs and nutrition. Data integrity checks are folded into FC Audit.
        </p>
      </div>
      <Tabs defaultValue="missing">
        <TabsList>
          <TabsTrigger value="missing">Missing Recipes</TabsTrigger>
          <TabsTrigger value="fc">FC Audit</TabsTrigger>
          <TabsTrigger value="verify">Recipe Verify</TabsTrigger>
          <TabsTrigger value="nutri">Nutri Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="missing" className="mt-4">
          <MissingRecipesPage />
        </TabsContent>
        <TabsContent value="fc" className="mt-4">
          <FcAuditPage country={country} />
        </TabsContent>
        <TabsContent value="verify" className="mt-4">
          <RecipeVerifyPage country={country} />
        </TabsContent>
        <TabsContent value="nutri" className="mt-4">
          <NutriAuditPage country={country} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
