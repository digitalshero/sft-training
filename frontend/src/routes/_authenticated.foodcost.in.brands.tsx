import { createFileRoute } from "@tanstack/react-router";
import { BrandsPage } from "@/lib/foodcost/pages/brands";
export const Route = createFileRoute("/_authenticated/foodcost/in/brands")({
  component: BrandsPage,
});
