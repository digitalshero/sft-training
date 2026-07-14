import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useMyPermissions } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/course")({
  component: CourseLanding,
});

function CourseLanding() {
  const navigate = useNavigate();
  const { isLoading, isSuperAdmin, permissions } = useMyPermissions();

  useEffect(() => {
    if (isLoading) return;

    if (isSuperAdmin || permissions.includes("sft_course_builder")) {
      navigate({ to: "/sft-training/program", replace: true });
      return;
    }

    if (permissions.includes("sft_invite_review")) {
      navigate({ to: "/sft-training/invite-certify", replace: true });
      return;
    }

    if (
      permissions.includes("foodcost_dashboard") ||
      permissions.includes("foodcost_in") ||
      permissions.includes("foodcost_us")
    ) {
      navigate({ to: "/foodcost", replace: true });
      return;
    }

    navigate({ to: "/partner", replace: true });
  }, [isLoading, isSuperAdmin, permissions, navigate]);

  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
    </div>
  );
}
