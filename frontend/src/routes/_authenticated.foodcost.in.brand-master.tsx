import { createFileRoute } from "@tanstack/react-router";
import { BrandMasterPage } from "@/lib/foodcost/pages/brand-master";
export const Route = createFileRoute(
  "/_authenticated/foodcost/in/brand-master",
)({ component: BrandMasterPage });
