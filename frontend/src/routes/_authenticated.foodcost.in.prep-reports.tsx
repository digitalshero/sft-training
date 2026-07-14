import { createFileRoute } from "@tanstack/react-router";
import { PrepReportsPage } from "@/lib/foodcost/pages/preps-reports";
export const Route = createFileRoute(
  "/_authenticated/foodcost/in/prep-reports",
)({ component: PrepReportsPage });
