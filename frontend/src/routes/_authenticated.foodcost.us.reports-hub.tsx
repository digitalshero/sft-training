import { createFileRoute } from "@tanstack/react-router";
import { ReportsHubPage } from "@/lib/foodcost/pages/reports-hub";
export const Route = createFileRoute("/_authenticated/foodcost/us/reports-hub")(
  { component: ReportsHubPage },
);
