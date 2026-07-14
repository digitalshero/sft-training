import { createFileRoute } from "@tanstack/react-router";
import { RecipeVerifyPage } from "@/lib/foodcost/pages/recipe-verify";
export const Route = createFileRoute(
  "/_authenticated/foodcost/us/recipe-verify",
)({
  component: () => <RecipeVerifyPage country="us" />,
});
