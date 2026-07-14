import { createFileRoute } from "@tanstack/react-router";
import { PackingContainersPage } from "@/lib/foodcost/pages/packing-containers";
export const Route = createFileRoute("/_authenticated/foodcost/us/packing")({
  component: PackingContainersPage,
});
