/* eslint-disable */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAllCourses,
  listInvites,
  listEligibleForCertificate,
  revokeInvite,
  adminIssueCertificate,
  adminRevokeCertificate,
  listExtraCertificates,
  adminIssueExtraCertificates,
  adminRevokeExtraCertificate,
  getCourse,
  ReviewPartnerRow,
  type ExtraCertificateTemplate,
} from "@/lib/learning/learning.functions";
import { CertificatePreview } from "@/components/sft/CertificatePreview";
import { formatDateET } from "@/lib/datetime-et";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Copy,
  Award,
  Ban,
  Eye,
  UserPlus,
  Download,
} from "lucide-react";
import { downloadCertificatePdf } from "@/lib/partner/certificate-pdf";
import { downloadComposedCertificate } from "@/lib/partner/certificate-design";

export const Route = createFileRoute(
  "/_authenticated/sft-training/invite-certify",
)({
  component: InviteCertifyPage,
});

function InviteCertifyPage() {
  const fnCourses = listAllCourses;
  const coursesQ = useQuery({
    queryKey: ["lp-all-courses"],
    queryFn: () => fnCourses(),
  });
  const [courseId, setCourseId] = useState<string>("");
  const selected = courseId || coursesQ.data?.[0]?.id || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Invite &amp; Certify
          </h2>
          <p className="text-sm text-muted-foreground">
            Onboard partners, manage the invite email, and issue certificates.
          </p>
        </div>
        <div className="w-full space-y-1 sm:w-auto sm:min-w-65">
          <Label className="text-xs">Course</Label>
          <Select value={selected} onValueChange={setCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a course" />
            </SelectTrigger>
            <SelectContent>
              {(coursesQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}{" "}
                  {!c.published && (
                    <span className="text-muted-foreground">(draft)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="invite" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invite">
            <UserPlus className="h-3 w-3" /> Invite
          </TabsTrigger>
          <TabsTrigger value="certify">
            <Award className="h-3 w-3" /> Certify
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invite">
          {selected ? (
            <InviteTab courseId={selected} />
          ) : (
            <EmptyHint label="Pick a course to invite partners." />
          )}
        </TabsContent>
        <TabsContent value="certify">
          {selected ? (
            <CertifyTab courseId={selected} />
          ) : (
            <EmptyHint label="Pick a course to manage certificates." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {label}
      </CardContent>
    </Card>
  );
}

function InviteTab({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const fnList = listInvites;
  const fnRevoke = revokeInvite;
  const q = useQuery({
    queryKey: ["lp-all-invites", courseId],
    queryFn: () => fnList({ course_id: courseId }),
  });

  const revoke = useMutation({
    mutationFn: fnRevoke,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["lp-all-invites", courseId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteLink = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/learn?invite=${token}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Invites ({q.data?.length ?? 0})
          </CardTitle>
          <CardDescription>
            Log of every invitee for this course.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {q.data?.length === 0 && (
            <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              No invites yet.
            </div>
          )}
          {q.data?.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {inv.recipient_name}{" "}
                  <span className="text-muted-foreground">
                    · {inv.recipient_email}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {inv.kitchen_location || "—"} · sent{" "}
                  {formatDateET(inv.sent_at)}
                </div>
              </div>
              <Badge
                variant={
                  inv.revoked_at
                    ? "destructive"
                    : inv.accepted_at
                      ? "default"
                      : inv.opened_at
                        ? "secondary"
                        : "outline"
                }
              >
                {inv.revoked_at
                  ? "Revoked"
                  : inv.accepted_at
                    ? "In progress"
                    : inv.opened_at
                      ? "Opened"
                      : "Sent"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink(inv.token));
                  toast.success("Invite link copied");
                }}
              >
                <Copy className="h-3 w-3" /> Copy link
              </Button>
              {!inv.revoked_at && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke.mutate({ id: inv.id })}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CertifyTab({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const fnList = listEligibleForCertificate;
  const fnCourse = getCourse;
  const fnIssue = adminIssueCertificate;
  const fnRevoke = adminRevokeCertificate;
  const q = useQuery({
    queryKey: ["lp-certify", courseId],
    queryFn: () => fnList({ courseId }),
  });
  const courseQ = useQuery({
    queryKey: ["lp-course", courseId],
    queryFn: () => fnCourse({ course_id: courseId }),
  });
  const issue = useMutation({
    mutationFn: fnIssue,
    onSuccess: () => {
      toast.success("Certificate issued");
      qc.invalidateQueries({ queryKey: ["lp-certify", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: fnRevoke,
    onSuccess: () => {
      toast.success("Certificate revoked");
      qc.invalidateQueries({ queryKey: ["lp-certify", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [previewName, setPreviewName] = useState<string | null>(null);

  // Additional certificates (beyond the single main one above) — stored and
  // tracked here so admins can see exactly what's been issued per partner.
  const extraCertsQ = useQuery({
    queryKey: ["lp-extra-certs", courseId],
    queryFn: () => listExtraCertificates({ course_id: courseId }),
  });
  const extraTemplates: ExtraCertificateTemplate[] = courseQ.data?.course.certificate_templates ?? [];
  const extraTemplateTitle = new Map(extraTemplates.map((t) => [t.id, t.title || "Certificate"]));
  const issueExtra = useMutation({
    mutationFn: adminIssueExtraCertificates,
    onSuccess: () => {
      toast.success("Additional certificates issued");
      qc.invalidateQueries({ queryKey: ["lp-extra-certs", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeExtra = useMutation({
    mutationFn: adminRevokeExtraCertificate,
    onSuccess: () => {
      toast.success("Certificate revoked");
      qc.invalidateQueries({ queryKey: ["lp-extra-certs", courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDownload(code: string, recipient: string, issuedAt?: string) {
    const template = courseQ.data?.course.certificate_template;
    const issued = issuedAt ?? new Date().toISOString();
    if (template?.background_path) {
      try {
        await downloadComposedCertificate(
          template,
          { partner_name: recipient, certificate_id: code, date: formatDateET(issued) },
          `certificate-${code}`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to render certificate");
      }
      return;
    }
    downloadCertificatePdf({
      course_title: courseQ.data?.course.title ?? "Shero Course",
      code,
      issued_at: issued,
      recipient_name: recipient,
      signatory_name: template?.signatory_name ?? null,
      signatory_role: template?.signatory_role ?? null,
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" /> Certify partners
          </CardTitle>
          <CardDescription>
            Invitees and certified partners for this course.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {q.data?.length === 0 && (
            <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              No accepted partners yet for this course.
            </div>
          )}
          {q.data?.map((row) => {
            type LocalReview = ReviewPartnerRow & {
              partner_name?: string;
              partner_email?: string;
              issued?: boolean;
              issued_at?: string;
              certificate_id?: string;
              certificate_code?: string;
            };
            const r = row as LocalReview;
            const partnerName = r.partner_name ?? r.recipient_name;
            const partnerEmail = r.partner_email ?? r.recipient_email;
            const certificateCode = r.certificate_code ?? undefined;
            const issuedAt = r.issued_at ?? r.certificate_issued_at ?? undefined;
            const certId = r.certificate_id ?? undefined;
            const isIssued = Boolean(r.issued ?? certificateCode);

            const theirExtraCerts = (extraCertsQ.data ?? []).filter(
              (e) => e.user_id === r.user_id,
            );

            return (
              <div
                key={r.user_id ?? r.invite_id}
                className="space-y-2 rounded-md border border-border p-3"
              >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{partnerName}</div>
                  <div className="text-xs text-muted-foreground">
                    {partnerEmail}
                  </div>
                </div>
                {isIssued ? (
                  <>
                    <Badge variant="default" className="gap-1">
                      <Award className="h-3 w-3" /> Issued · {certificateCode}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewName(partnerName)}
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDownload(certificateCode!, partnerName, issuedAt)
                      }
                    >
                      <Download className="h-3 w-3" /> Download
                    </Button>
                    {certId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revoke.mutate({ id: certId })}
                      >
                        <Ban className="h-3 w-3" /> Revoke
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      r.user_id &&
                      issue.mutate({ course_id: courseId, user_id: r.user_id })
                    }
                  >
                    <Award className="h-3 w-3" /> Issue certificate
                  </Button>
                )}
              </div>

              {extraTemplates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-2">
                  <span className="text-xs text-muted-foreground">
                    Additional certificates ({theirExtraCerts.length}/{extraTemplates.length}):
                  </span>
                  {theirExtraCerts.map((c) => (
                    <Badge key={c.id} variant="secondary" className="gap-1">
                      {extraTemplateTitle.get(c.template_id) ?? "Certificate"} · {c.code}
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => revokeExtra.mutate({ id: c.id })}
                        title="Revoke"
                      >
                        <Ban className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {theirExtraCerts.length < extraTemplates.length && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!r.user_id || issueExtra.isPending}
                      onClick={() =>
                        r.user_id &&
                        issueExtra.mutate({ course_id: courseId, user_id: r.user_id })
                      }
                    >
                      <Award className="h-3 w-3" /> Issue remaining
                    </Button>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog
        open={!!previewName}
        onOpenChange={(o) => !o && setPreviewName(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Certificate preview</DialogTitle>
          </DialogHeader>
          {previewName && courseQ.data && (
            <CertificatePreview
              template={courseQ.data.course.certificate_template ?? {}}
              partnerName={previewName}
              courseTitle={courseQ.data.course.title}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
