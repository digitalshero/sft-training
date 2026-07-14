import { createFileRoute } from "@tanstack/react-router";
import { FcAuditPage } from "@/lib/foodcost/pages/fc-audit";
export const Route = createFileRoute("/_authenticated/foodcost/us/fc-audit")({
  component: () => <FcAuditPage country="us" />,
});
