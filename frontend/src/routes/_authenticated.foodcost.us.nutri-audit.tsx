import { createFileRoute } from "@tanstack/react-router";
import { NutriAuditPage } from "@/lib/foodcost/pages/nutri-audit";
export const Route = createFileRoute("/_authenticated/foodcost/us/nutri-audit")(
  {
    component: () => <NutriAuditPage country="us" />,
  },
);
