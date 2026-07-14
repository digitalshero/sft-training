import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssignVisitorForm } from "@/components/sft/AssignVisitorForm";
import { listPhysicalVisits } from "@/lib/sft/physical-visit.functions";

export const Route = createFileRoute(
  "/_authenticated/sft-training/physical-visit/assign/$visitId",
)({
  component: AssignVisitorPage,
});

function AssignVisitorPage() {
  const { visitId } = Route.useParams();
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
          const visit = (q.data ?? []).find((v) => v.id === visitId);
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
