import { createFileRoute } from "@tanstack/react-router";
import { MenuCostingPage } from "@/lib/foodcost/pages/menu-costing";
export const Route = createFileRoute(
  "/_authenticated/foodcost/us/menu-costing",
)({ component: MenuCostingPage });
