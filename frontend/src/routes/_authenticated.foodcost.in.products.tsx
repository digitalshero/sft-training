import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/lib/foodcost/pages/products";
export const Route = createFileRoute("/_authenticated/foodcost/in/products")({
  component: ProductsPage,
});
