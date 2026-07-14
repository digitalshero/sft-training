import { createFileRoute } from "@tanstack/react-router";
import { PrepsPage } from "@/lib/foodcost/pages/preps";
export const Route = createFileRoute("/_authenticated/foodcost/in/preps")({
  component: PrepsPage,
});
