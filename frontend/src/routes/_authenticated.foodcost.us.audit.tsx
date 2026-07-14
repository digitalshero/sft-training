import { createFileRoute } from "@tanstack/react-router";
import { AuditPage } from "@/lib/foodcost/pages/audit";
export const Route = createFileRoute("/_authenticated/foodcost/us/audit")({
  component: AuditPage,
});
