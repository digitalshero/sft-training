import { createFileRoute } from "@tanstack/react-router";
import { IngredientsPage } from "@/lib/foodcost/pages/ingredients";
export const Route = createFileRoute("/_authenticated/foodcost/us/ingredients")(
  { component: IngredientsPage },
);
