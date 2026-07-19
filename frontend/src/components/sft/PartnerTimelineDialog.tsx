import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getPartnerTimeline,
  reviewProductSubmissionPerFile,
  adminIssueCertificate,
  adminRevokeCertificate,
} from "@/lib/learning/learning.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeET, formatDateTimeETPrecise } from "@/lib/datetime-et";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  Ban,
  Clock,
  FileImage,
} from "lucide-react";

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const tone: Record<string, string> = {
    approved:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    pending:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    redo: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    rejected: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    sent: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    invited: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    accepted:
      "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  };
  return (
    <Badge variant="outline" className={tone[value] ?? ""}>
      {value}
    </Badge>
  );
}

export function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return formatDateTimeET(d);
}

function fmtPrecise(d: string | null | undefined) {
  if (!d) return "—";
  return formatDateTimeETPrecise(d);
}

type SubmissionFile = {
  path: string;
  label?: string | null;
  decision?: "approved" | "redo" | null;
  remark?: string | null;
};

type SubmissionWithSignedFiles = {
  id: string;
  submitted_at: string;
  reviewed_at: string | null;
  feedback?: string | null;
  notes?: string | null;
  status: string;
  files_signed: Array<{
    path: string;
    label?: string | null;
    url: string;
    decision?: "approved" | "redo" | null;
    remark?: string | null;
  }>;
};

type PartnerTimelineData = {
  partner: {
    display_name?: string | null;
    email: string;
    user_id?: string | null;
    mobile?: string | null;
    city?: string | null;
    cuisines?: string[];
  };
  invite?: { recipient_name?: string | null };
  course: { id?: string; title: string };
  modules: Array<{
    id: string;
    title: string;
    sort_order: number;
    completed_at: string | null;
    progress_pct?: number | null;
  }>;
  submissions: SubmissionWithSignedFiles[];
  certificate?: { id: string; code: string; issued_at: string | null } | null;
  timeline: Array<{
    title: string;
    at?: string | null;
    detail?: string | null;
  }>;
};

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
}

export function PartnerTimelineDialog({
  inviteId,
  onOpenChange,
}: {
  inviteId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const fnGet = getPartnerTimeline;
  const fnIssue = adminIssueCertificate;
  const fnRevoke = adminRevokeCertificate;

  const q = useQuery<PartnerTimelineData>({
    queryKey: ["lp-partner-timeline", inviteId],
    queryFn: () => fnGet({ invite_id: inviteId }),
  });

  const issue = useMutation({
    mutationFn: () =>
      fnIssue({
        user_id: q.data!.partner.user_id!,
        course_id: q.data!.course.id!,
      }),
    onSuccess: () => {
      toast.success("Certificate issued");
      qc.invalidateQueries({ queryKey: ["lp-partner-timeline", inviteId] });
      qc.invalidateQueries({ queryKey: ["lp-review-partners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: () => fnRevoke({ id: q.data!.certificate!.id }),
    onSuccess: () => {
      toast.success("Certificate revoked");
      qc.invalidateQueries({ queryKey: ["lp-partner-timeline", inviteId] });
      qc.invalidateQueries({ queryKey: ["lp-review-partners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data?.partner.display_name ||
              data?.invite?.recipient_name ||
              "Partner"}
          </DialogTitle>
          <DialogDescription>
            {data?.partner.email} · {data?.course.title}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading || !data ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading timeline…
          </div>
        ) : (
          <div className="space-y-5">
            {/* Partner information */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Partner Information
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border p-3 sm:grid-cols-3">
                <InfoField
                  label="Name"
                  value={
                    data.partner.display_name ||
                    data.invite?.recipient_name ||
                    "—"
                  }
                />
                <InfoField
                  label="Partner ID"
                  value={data.partner.user_id ?? "—"}
                />
                <InfoField label="Mobile" value={data.partner.mobile ?? "—"} />
                <InfoField label="Email" value={data.partner.email} />
                <InfoField label="City" value={data.partner.city ?? "—"} />
                <InfoField
                  label="Selected Cuisine(s)"
                  value={
                    data.partner.cuisines?.length
                      ? data.partner.cuisines.join(", ")
                      : "—"
                  }
                />
              </div>
            </section>

            {/* Modules progress */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Modules</h3>
              <div className="rounded-md border">
                {data.modules.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">
                    No published modules.
                  </div>
                )}
                {data.modules.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      {m.completed_at ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>
                        {m.sort_order + 1}. {m.title}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.completed_at
                        ? `Completed ${fmt(m.completed_at)}`
                        : `${m.progress_pct ?? 0}%`}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Product submissions (date-wise; newest first) */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileImage className="h-4 w-4" /> Product submissions
                <span className="text-xs font-normal text-muted-foreground">
                  ({data.submissions.length}{" "}
                  {data.submissions.length === 1 ? "round" : "rounds"})
                </span>
              </h3>
              {data.submissions.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Partner has not uploaded product photos yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.submissions.map((sub, idx) => (
                    <SubmissionReviewCard
                      key={sub.id}
                      submission={sub}
                      isLatest={idx === 0}
                      partnerName={
                        data.partner.display_name ||
                        data.invite?.recipient_name ||
                        "Partner"
                      }
                      partnerEmail={data.partner.email}
                      courseTitle={data.course.title}
                      inviteId={inviteId}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Certificate */}
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Award className="h-4 w-4" /> Certificate
              </h3>
              {data.certificate ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div className="text-sm">
                    <div className="font-medium">{data.certificate.code}</div>
                    <div className="text-xs text-muted-foreground">
                      Issued {fmt(data.certificate.issued_at)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (confirm("Revoke this certificate?")) revoke.mutate();
                    }}
                  >
                    <Ban className="mr-1 h-3.5 w-3.5" /> Revoke
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3">
                  <span className="text-sm text-muted-foreground">
                    No certificate yet. Auto-issued when the partner finishes
                    modules and product is approved.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.partner.user_id || issue.isPending}
                    onClick={() => issue.mutate()}
                  >
                    <Award className="mr-1 h-3.5 w-3.5" /> Issue manually
                  </Button>
                </div>
              )}
            </section>

            {/* Timeline */}
            <section>
              <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
              <ol className="relative space-y-3 border-l pl-4">
                {data.timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-5.25 top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium capitalize">
                        {t.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtPrecise(t.at)}
                      </span>
                    </div>
                    {t.detail && (
                      <div className="text-xs text-muted-foreground wrap-break-word">
                        {t.detail}
                      </div>
                    )}
                  </li>
                ))}
                {data.timeline.length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No activity yet.
                  </li>
                )}
              </ol>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionReviewCard({
  submission,
  isLatest,
  partnerName,
  partnerEmail,
  courseTitle,
  inviteId,
}: {
  submission: SubmissionWithSignedFiles;
  isLatest: boolean;
  partnerName: string;
  partnerEmail: string;
  courseTitle: string;
  inviteId: string;
}) {
  const qc = useQueryClient();
  const fnSave = reviewProductSubmissionPerFile;
  const reviewed = !!submission.reviewed_at;
  const locked = reviewed && !isLatest; // older rounds are read-only

  const initialFiles: SubmissionFile[] = (submission.files_signed ?? []).map(
    (f) => ({
      path: f.path,
      label: f.label,
      decision: f.decision,
      remark: f.remark,
    }),
  );
  const [files, setFiles] = useState<SubmissionFile[]>(initialFiles);
  const [feedback, setFeedback] = useState<string>(submission.feedback ?? "");

  const allDecided = files.every(
    (f) => f.decision === "approved" || f.decision === "redo",
  );
  const anyRedo = files.some((f) => f.decision === "redo");

  const save = useMutation({
    mutationFn: () =>
      fnSave({
        id: submission.id,
        decision: "approved",
        feedback: feedback || undefined,
        files: files.map((f) => ({
          path: f.path,
          label: f.label,
          decision: (f.decision ?? "approved") as "approved" | "redo",
          remark: f.remark || undefined,
        })),
      }),
    onSuccess: (res) => {
      toast.success(
        res.status === "approved" ? "Approved" : "Marked for approved",
      );
      qc.invalidateQueries({ queryKey: ["lp-partner-timeline", inviteId] });
      qc.invalidateQueries({ queryKey: ["lp-review-partners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setFileDecision(idx: number, decision: "approved" | "redo") {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, decision } : f)),
    );
  }
  function setFileRemark(idx: number, remark: string) {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, remark } : f)));
  }

  function composeRedoMailto() {
    const rejected = (submission.files_signed ?? [])
      .map((f, i) => ({
        ...f,
        decision: files[i]?.decision,
        remark: files[i]?.remark,
      }))
      .filter((f) => f.decision === "redo");
    const subject = `Action needed: please redo ${rejected.length} product photo${rejected.length === 1 ? "" : "s"} — ${courseTitle}`;
    const lines: string[] = [];
    lines.push(`Hi ${partnerName},`, "");
    lines.push(
      `Thank you for submitting your photos on ${formatDateTimeET(submission.submitted_at)}.`,
    );
    lines.push(
      `We need you to redo the following ${rejected.length} item${rejected.length === 1 ? "" : "s"}:`,
      "",
    );
    rejected.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.label ?? f.path.split("/").pop()}`);
      lines.push(`   Photo: ${f.url}`);
      if (f.remark) lines.push(`   What to fix: ${f.remark}`);
      lines.push("");
    });
    if (feedback) lines.push(`Overall notes from your trainer:`, feedback, "");
    lines.push(
      `Please re-upload corrected photos in your training dashboard. Reach out if anything is unclear.`,
      "",
      `— SHE-RO Training`,
    );
    const href = `mailto:${encodeURIComponent(partnerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = href;
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium">
            {isLatest ? "Latest round" : "Earlier round"}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            Submitted {fmt(submission.submitted_at)}
            {submission.reviewed_at && (
              <> · Reviewed {fmt(submission.reviewed_at)}</>
            )}
          </span>
        </div>
        <StatusBadge value={submission.status} />
      </div>

      {submission.notes && (
        <div className="rounded bg-muted/50 p-2 text-xs">
          <span className="font-medium">Partner notes:</span> {submission.notes}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(submission.files_signed ?? []).map((f, idx) => {
          const decision = files[idx]?.decision;
          const remark = files[idx]?.remark ?? "";
          return (
            <div key={f.path} className="space-y-2 rounded-md border p-2">
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded bg-muted"
              >
                <img
                  src={f.url}
                  alt={f.label ?? "submission"}
                  className="h-full w-full object-cover"
                />
              </a>
              <div
                className="truncate text-xs text-muted-foreground"
                title={f.label ?? f.path}
              >
                {f.label ?? f.path.split("/").pop()}
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={locked}
                  variant={decision === "approved" ? "default" : "outline"}
                  className={
                    decision === "approved"
                      ? "flex-1 bg-emerald-600 hover:bg-emerald-600/90"
                      : "flex-1"
                  }
                  onClick={() => setFileDecision(idx, "approved")}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Right
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={locked}
                  variant={decision === "redo" ? "default" : "outline"}
                  className={
                    decision === "redo"
                      ? "flex-1 bg-orange-600 hover:bg-orange-600/90"
                      : "flex-1"
                  }
                  onClick={() => setFileDecision(idx, "redo")}
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" /> Redo
                </Button>
              </div>
              {decision === "redo" && (
                <Textarea
                  rows={2}
                  disabled={locked}
                  placeholder="What to fix on this photo…"
                  value={remark}
                  onChange={(e) => setFileRemark(idx, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>

      <Textarea
        rows={2}
        disabled={locked}
        placeholder="Overall remarks to include in the email (optional)…"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />

      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={!allDecided || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            )}
            Save review
          </Button>
          {anyRedo && (
            <Button size="sm" variant="outline" onClick={composeRedoMailto}>
              <XCircle className="mr-1 h-3.5 w-3.5" /> Compose redo email
            </Button>
          )}
          {!allDecided && (
            <span className="text-xs text-muted-foreground">
              Mark every photo as Right or Redo to save.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
