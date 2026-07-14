import { useQuery } from "@tanstack/react-query";
import {
  getCourse,
  myProductSubmissionsSigned,
} from "@/lib/learning/learning.functions";
import { ProductUploadCard } from "@/components/learn/ProductUploadCard";
import { formatDateTimeET } from "@/lib/datetime-et";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MessageSquare,
  RotateCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

type SubmissionFileSigned = {
  url: string;
  label?: string;
};

type ProductSubmission = {
  id: string;
  status: "pending" | "approved" | "redo" | "rejected" | string;
  submitted_at: string;
  notes?: string;
  feedback?: string;
  files_signed: SubmissionFileSigned[];
};

const STATUS_META: Record<
  string,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  pending: {
    label: "In review",
    cls: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    Icon: Clock,
  },
  approved: {
    label: "Approved",
    cls: "bg-accent/10 text-accent border-accent/40",
    Icon: CheckCircle2,
  },
  redo: {
    label: "Needs redo",
    cls: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/40",
    Icon: RotateCw,
  },
  rejected: {
    label: "Rejected",
    cls: "bg-destructive/10 text-destructive border-destructive/40",
    Icon: XCircle,
  },
};

export function UploadPanel({
  courseId,
  allModulesComplete,
}: {
  courseId: string;
  allModulesComplete: boolean;
}) {
  const fnCourse = getCourse;
  const fnSubs = myProductSubmissionsSigned;
  const courseQ = useQuery({
    queryKey: ["lp-course-learner", courseId],
    queryFn: () => fnCourse({ course_id: courseId }),
  });
  const subsQ = useQuery({
    queryKey: ["lp-product-subs-signed", courseId],
    queryFn: () => fnSubs({ courseId }),
  });

  if (courseQ.isLoading || subsQ.isLoading || !courseQ.data) {
    return <Loader2 className="h-5 w-5 animate-spin text-accent" />;
  }
  const subs = subsQ.data ?? [];
  const latest = subs[0];
  const needsRedo =
    latest && (latest.status === "redo" || latest.status === "rejected");

  return (
    <div className="space-y-5">
      {latest && latest.feedback && (
        <Card
          className={needsRedo ? "border-orange-500/40 bg-orange-500/5" : ""}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" /> Message from your trainer
            </CardTitle>
            <CardDescription>
              About your submission on{" "}
              {formatDateTimeET(latest.submitted_at)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap">{latest.feedback}</p>
            {needsRedo && (
              <p className="text-xs text-orange-700 dark:text-orange-400">
                Please re-take the photos following the feedback above and
                upload again below.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <ProductUploadCard
        course={courseQ.data.course}
        allModulesComplete={allModulesComplete}
      />

      {subs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Your previous submissions
            </CardTitle>
            <CardDescription>
              Photos you have sent for trainer review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subs.map((s: ProductSubmission) => {
              const meta = STATUS_META[s.status];
              return (
                <div
                  key={s.id}
                  className="space-y-2 rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Submitted {formatDateTimeET(s.submitted_at)}
                    </div>
                    {meta && (
                      <Badge variant="outline" className={meta.cls}>
                        <meta.Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                    )}
                  </div>
                  {s.notes && (
                    <div className="text-xs">
                      <span className="font-medium">Your notes:</span> {s.notes}
                    </div>
                  )}
                  {s.feedback && (
                    <div className="rounded border-l-2 border-accent bg-muted/30 p-2 text-xs">
                      <span className="font-medium">Trainer feedback:</span>{" "}
                      {s.feedback}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {s.files_signed.map(
                      (f: SubmissionFileSigned, i: number) => (
                        <a
                          key={i}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <img
                            src={f.url}
                            alt={f.label ?? `photo-${i}`}
                            className="aspect-square w-full rounded-md border border-border object-cover transition hover:opacity-90"
                          />
                        </a>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
