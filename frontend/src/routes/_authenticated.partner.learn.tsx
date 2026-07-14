import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getPartnerDashboard } from "@/lib/partner/partner.functions";

export const Route = createFileRoute("/_authenticated/partner/learn")({
  component: PartnerLearnRedirect,
});

// This page has no UI of its own — it exists only so old links/bookmarks to
// /partner/learn still work, by forwarding straight to the real learning page.
function PartnerLearnRedirect() {
  const navigate = useNavigate();
  const dashQ = useQuery({
    queryKey: ["partner-dash"],
    queryFn: () => getPartnerDashboard(),
  });
  const invite = dashQ.data?.invites[0];

  useEffect(() => {
    if (invite) {
      navigate({
        to: "/learn/$courseId",
        params: { courseId: invite.course_id },
        replace: true,
      });
    } else if (dashQ.isSuccess) {
      navigate({ to: "/partner", replace: true });
    }
  }, [invite, dashQ.isSuccess, navigate]);

  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-accent" />
    </div>
  );
}
