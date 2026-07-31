import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssignVisitorForm } from "@/components/sft/AssignVisitorForm";
import {
  listPhysicalVisits,
  type PhysicalVisitRow,
} from "@/lib/sft/physical-visit.functions";

type AssignVisitorSearch = {
  course_id?: string;
  partner_name?: string;
  partner_email?: string;
};

export const Route = createFileRoute(
  "/_authenticated/sft-training/physical-visit/assign/$visitId",
)({
  // Only present when arriving via a manual "push to Physical Visit" link
  // (e.g. from SFT Review) for a partner the automatic eligibility scan
  // hasn't picked up yet — lets this page build a placeholder visit row
  // itself instead of only ever looking one up in the auto-detected list.
  // All optional so existing links to this route need not pass any of them.
  validateSearch: (s: Record<string, unknown>): AssignVisitorSearch => ({
    course_id: typeof s.course_id === "string" ? s.course_id : undefined,
    partner_name: typeof s.partner_name === "string" ? s.partner_name : undefined,
    partner_email: typeof s.partner_email === "string" ? s.partner_email : undefined,
  }),
  component: AssignVisitorPage,
});

// Same "eligible-<userId>" convention the automatic scan's own rows already
// use — POST /physical-visits/:id/assign already knows how to turn this
// into a real visit record on first save. This is only a client-side
// placeholder so the form has something to render before that save.
function manualEligibleVisitRow(
  userId: string,
  courseId: string,
  partnerName: string | undefined,
  partnerEmail: string | undefined,
): PhysicalVisitRow {
  return {
    id: `eligible-${userId}`,
    user_id: userId,
    course_id: courseId,
    recipe_id: null,
    submission_id: null,
    attempt_no: 1,
    partner_name: partnerName ?? null,
    partner_email: partnerEmail ?? null,
    partner_location: null,
    partner_state: null,
    partner_country: null,
    partner_phone: null,
    partner_address: null,
    recipe_name: null,
    cuisine_id: null,
    cuisine_name: null,
    assigned_products: [],
    visitor_name: null,
    visitor_email: null,
    visitor_phone: null,
    visit_date: null,
    visit_time: null,
    remarks: null,
    status: "eligible",
    email_status: "pending",
    visitor_email_sent_at: null,
    partner_email_sent_at: null,
    submitted_at: null,
    decision: null,
    decision_comments: null,
    total_products: null,
    accepted_products: null,
    rejected_products: null,
    inspection_percentage: null,
    product_inspections: [],
    visitor_location: null,
    form_status: "not_sent",
    history: [],
    photos: [],
    invite_id: null,
  };
}

function AssignVisitorPage() {
  const { visitId } = Route.useParams();
  const { course_id, partner_name, partner_email } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["physical-visits-all"],
    queryFn: () => listPhysicalVisits(),
  });

  const goBack = () =>
    navigate({ to: "/sft-training/physical-visit" });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground hover:text-foreground"
      >
        <Link to="/sft-training/physical-visit">
          <ArrowLeft className="h-4 w-4" /> Physical Visit Management
        </Link>
      </Button>

      {q.isLoading ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-accent" />
          </CardContent>
        </Card>
      ) : (
        (() => {
          let visit = (q.data ?? []).find((v) => v.id === visitId);
          if (!visit && visitId.startsWith("eligible-") && course_id) {
            visit = manualEligibleVisitRow(
              visitId.replace("eligible-", ""),
              course_id,
              partner_name,
              partner_email,
            );
          }
          if (!visit) {
            return (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  This visit could not be found.
                </CardContent>
              </Card>
            );
          }
          const isReschedule =
            visit.status === "rejected" ||
            visit.status === "waiting_admin_reschedule";
          return (
            <AssignVisitorForm
              visit={visit}
              isReschedule={isReschedule}
              onCancel={goBack}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["physical-visits"] });
                qc.invalidateQueries({ queryKey: ["physical-visits-all"] });
                goBack();
              }}
            />
          );
        })()
      )}
    </div>
  );
}
