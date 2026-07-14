import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/lib/foodcost/pages/categories";
export const Route = createFileRoute("/_authenticated/foodcost/us/categories")({
  component: CategoriesPage,
});
