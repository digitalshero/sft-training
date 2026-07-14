import { createFileRoute } from "@tanstack/react-router";
import { FoodCostReportsPage } from "@/components/foodcost/reports-page";

export const Route = createFileRoute("/_authenticated/foodcost/in/reports")({
  component: FoodCostReportsPage,
});
