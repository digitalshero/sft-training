// Certificate card on the partner course overview. Auto-attempts issuance
// when prerequisites are met, then shows download + share code.

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  myCertificate,
  issueCertificateIfEligible,
  type Course,
} from "@/lib/learning/learning.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Loader2, Lock } from "lucide-react";
import { formatDateET } from "@/lib/datetime-et";

interface Props {
  course: Course;
  eligible: boolean;
}

export function CertificateCard({ course, eligible }: Props) {
  const qc = useQueryClient();
  const fnMine = myCertificate;
  const fnIssue = issueCertificateIfEligible;

  const certQ = useQuery({
    queryKey: ["lp-certificate", course.id],
    queryFn: () => fnMine({ courseId: course.id }),
  });

  const issueMut = useMutation({
    mutationFn: () => fnIssue({ courseId: course.id }),
    onSuccess: (r) => {
      if (r.issued) qc.invalidateQueries({ queryKey: ["lp-certificate", course.id] });
    },
  });

  useEffect(() => {
    if (eligible && !certQ.data && !issueMut.isPending && certQ.isFetched) {
      issueMut.mutate();
    }
  }, [eligible, certQ.data, certQ.isFetched, issueMut]);

  const cert = certQ.data;
  const tpl = course.certificate_template ?? {};

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-accent" />
            <CardTitle className="text-base">{tpl.title || "Completion Certificate"}</CardTitle>
          </div>
          {cert ? (
            <Badge>Issued</Badge>
          ) : eligible ? (
            <Badge variant="outline">Ready to issue</Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" /> Locked
            </Badge>
          )}
        </div>
        <CardDescription>
          {tpl.subtitle || "Awarded once you complete the course and pass the required reviews."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {certQ.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
          </div>
        )}
        {cert ? (
          <div className="rounded-md border border-accent/30 bg-accent/5 p-4">
            <div className="font-display text-lg font-semibold">{course.title}</div>
            {tpl.body_md && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {tpl.body_md}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs">
              <Badge variant="outline" className="font-mono">
                {cert.code}
              </Badge>
              <span className="text-muted-foreground">
                Issued {formatDateET(cert.issued_at)}
              </span>
            </div>
            {(tpl.signatory_name || tpl.signatory_role) && (
              <div className="mt-3 text-xs text-muted-foreground">
                {tpl.signatory_name}
                {tpl.signatory_role ? ` · ${tpl.signatory_role}` : ""}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {eligible
              ? "All prerequisites met — issuing your certificate…"
              : "Complete every module, get your product upload approved, and pass the kitchen inspection if required."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
