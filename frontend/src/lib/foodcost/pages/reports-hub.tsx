import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFoodcostCountry, COUNTRY_LABEL } from "@/lib/foodcost/country";
import { FoodCostReportsPage } from "@/components/foodcost/reports-page";
import { PrepReportsPage } from "@/lib/foodcost/pages/preps-reports";

export function ReportsHubPage() {
  const country = useFoodcostCountry();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">
          Reports{" "}
          {country && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — {COUNTRY_LABEL[country]}
            </span>
          )}
        </h1>
        <p className="text-xs text-muted-foreground">
          Cost reports, pre-prep impact and download history.
        </p>
      </div>
      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="prep">Prep Reports</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="mt-4">
          <FoodCostReportsPage />
        </TabsContent>
        <TabsContent value="prep" className="mt-4">
          <PrepReportsPage />
        </TabsContent>
        <TabsContent value="downloads" className="mt-4">
          <div className="rounded-2xl border border-border bg-surface-elevated p-6 text-sm text-muted-foreground">
            Download history (user, file, time) will appear here once download tracking is enabled.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
