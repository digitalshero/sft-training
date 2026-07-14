import { createFileRoute } from "@tanstack/react-router";
import { MenuPage } from "@/lib/foodcost/pages/menu";
export const Route = createFileRoute("/_authenticated/foodcost/us/menu")({
  component: MenuPage,
});
