import { createFileRoute } from "@tanstack/react-router";
import { MissingRecipesPage } from "@/lib/foodcost/pages/missing-recipes";
export const Route = createFileRoute(
  "/_authenticated/foodcost/in/missing-recipes",
)({ component: MissingRecipesPage });
