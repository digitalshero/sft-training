import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  updateCourseConfig,
  listInvites,
  createInvite,
  revokeInvite,
  type Course,
  type InspectionRubricItem,
  type ExtraCertificateTemplate,
} from "@/lib/learning/learning.functions";
import { sendPartnerLoginLink } from "@/lib/partner/partner.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, Trash2, Copy, Mail } from "lucide-react";
import { formatDateET } from "@/lib/datetime-et";

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

const ALL_LANGS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
];

export function ProductBriefTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fn = updateCourseConfig;
  const [title, setTitle] = useState(course.product_brief?.title ?? "");
  const [instructions, setInstructions] = useState(
    course.product_brief?.instructions ?? "",
  );
  const [requiredPhotos, setRequiredPhotos] = useState(
    (course.product_brief?.required_photos ?? []).join("\n"),
  );

  const save = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Product brief saved");
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Product Brief (Day {course.day5_gate_days}+)
        </CardTitle>
        <CardDescription>
          What partners must cook and photograph to unlock physical inspection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Brief title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Plain Dosa + Coconut Chutney"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">
            Instructions to the partner (markdown)
          </Label>
          <Textarea
            rows={6}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Required photos (one per line)</Label>
          <Textarea
            rows={4}
            value={requiredPhotos}
            placeholder={
              "Top-down plate shot\nClose-up of crust\nServing setup"
            }
            onChange={(e) => setRequiredPhotos(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                course_id: course.id,
                product_brief: {
                  title,
                  instructions,
                  required_photos: requiredPhotos
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function InspectionTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fn = updateCourseConfig;
  const [items, setItems] = useState<InspectionRubricItem[]>(
    course.inspection_rubric?.items ?? [],
  );
  const [passPct, setPassPct] = useState(
    course.inspection_rubric?.pass_pct ?? 70,
  );

  const save = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Inspection rubric saved");
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Physical Inspection & Tasting Rubric
        </CardTitle>
        <CardDescription>
          Inspector scores each item. Weighted total decides pass/fail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Pass percentage</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={passPct}
              onChange={(e) => setPassPct(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setItems([...items, { id: newId(), label: "", weight: 10 }])
              }
            >
              <Plus className="h-3 w-3" /> Add criterion
            </Button>
          </div>
        </div>
        {items.length === 0 && (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            No criteria yet. Add at least one before inspections can be
            recorded.
          </div>
        )}
        {items.map((it, i) => (
          <div
            key={it.id}
            className="flex items-start gap-2 rounded-md border border-border p-3"
          >
            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-12">
              <Input
                className="sm:col-span-6"
                value={it.label}
                placeholder="Criterion (e.g. Crispness)"
                onChange={(e) =>
                  setItems(
                    items.map((x, xi) =>
                      xi === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                className="sm:col-span-2"
                type="number"
                min={0}
                max={100}
                value={it.weight}
                onChange={(e) =>
                  setItems(
                    items.map((x, xi) =>
                      xi === i ? { ...x, weight: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
              <Input
                className="sm:col-span-4"
                value={it.description ?? ""}
                placeholder="Description (optional)"
                onChange={(e) =>
                  setItems(
                    items.map((x, xi) =>
                      xi === i ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setItems(items.filter((_, xi) => xi !== i))}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                course_id: course.id,
                inspection_rubric: { items, pass_pct: passPct },
              })
            }
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { CertificatePreview } from "./CertificatePreview";
import { CertificateDesignEditor, CertificateDesignPreview } from "./CertificateDesignEditor";
import type { CertificateTemplate } from "@/lib/learning/learning.functions";
import {
  Dialog as PreviewDialog,
  DialogContent as PreviewContent,
  DialogHeader as PreviewHeader,
  DialogTitle as PreviewTitle,
  DialogTrigger as PreviewTrigger,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";

export function CertificateTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fn = updateCourseConfig;
  const c = course.certificate_template ?? {};
  const [cert, setCert] = useState<CertificateTemplate>({
    title: c.title ?? "Certificate of Completion",
    subtitle: c.subtitle ?? "Shero Certified Partner Program",
    body_md:
      c.body_md ??
      "This certifies that **{{partner_name}}** has successfully completed the {{course_title}} course.",
    signatory_name: c.signatory_name ?? "",
    signatory_role: c.signatory_role ?? "Head of Training",
    accent_color: c.accent_color ?? "#7c3aed",
    background_path: c.background_path,
    background_width: c.background_width,
    background_height: c.background_height,
    tokens: c.tokens,
  });

  const save = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Certificate saved");
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificate design</CardTitle>
          <CardDescription>
            Upload your own certificate artwork and drag the partner name,
            certificate ID, date, and signatures onto it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <CertificateDesignEditor
            design={cert}
            onChange={(patch) => setCert({ ...cert, ...patch })}
          />
          <div className="flex justify-between pt-2">
            <PreviewDialog>
              <PreviewTrigger asChild>
                <Button variant="outline">
                  <Eye className="h-4 w-4" /> Preview
                </Button>
              </PreviewTrigger>
              <PreviewContent className="max-w-4xl">
                <PreviewHeader>
                  <PreviewTitle>Certificate preview</PreviewTitle>
                </PreviewHeader>
                {cert.background_path ? (
                  <CertificateDesignPreview design={cert} />
                ) : (
                  <CertificatePreview template={cert} courseTitle={course.title} />
                )}
              </PreviewContent>
            </PreviewDialog>
            <Button
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  course_id: course.id,
                  certificate_template: cert,
                })
              }
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save certificate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live preview</CardTitle>
          <CardDescription>
            This is exactly how the partner's certificate will look.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cert.background_path ? (
            <CertificateDesignPreview design={cert} />
          ) : (
            <CertificatePreview template={cert} courseTitle={course.title} />
          )}
        </CardContent>
      </Card>
    </div>

    <ExtraCertificatesEditor course={course} />
    </div>
  );
}

// Additional certificate templates, beyond the single main one above. A
// course can define several — a partner who completes the whole course gets
// all of them issued and can download each separately from Downloads.
function ExtraCertificatesEditor({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fn = updateCourseConfig;
  const [templates, setTemplates] = useState<ExtraCertificateTemplate[]>(
    course.certificate_templates ?? [],
  );
  const [openPreviewId, setOpenPreviewId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Additional certificates saved");
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addCertificate() {
    setTemplates((prev) => [
      ...prev,
      {
        id: newId(),
        title: "Certificate of Completion",
        subtitle: "Shero Certified Partner Program",
        body_md:
          "This certifies that **{{partner_name}}** has successfully completed the {{course_title}} course.",
        signatory_name: "",
        signatory_role: "Head of Training",
        accent_color: "#7c3aed",
      },
    ]);
  }
  function updateCertificate(id: string, patch: Partial<ExtraCertificateTemplate>) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function removeCertificate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }
  function saveAll() {
    save.mutate({ course_id: course.id, certificate_templates: templates });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Additional certificates</CardTitle>
          <CardDescription>
            Define extra certificates for this course — a partner gets every
            one of these, plus the main certificate above, once they
            complete the whole course. Each shows up separately in Downloads.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={addCertificate}>
          <Plus className="h-4 w-4" /> Add certificate
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length === 0 && (
          <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No additional certificates yet. Click "Add certificate" to define one.
          </div>
        )}
        {templates.map((t, idx) => (
          <div key={t.id} className="grid gap-4 rounded-lg border border-border p-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Certificate #{idx + 1}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeCertificate(t.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  value={t.title ?? ""}
                  onChange={(e) => updateCertificate(t.id, { title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subtitle</Label>
                <Input
                  value={t.subtitle ?? ""}
                  onChange={(e) => updateCertificate(t.id, { subtitle: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body (markdown)</Label>
                <Textarea
                  rows={3}
                  value={t.body_md ?? ""}
                  onChange={(e) => updateCertificate(t.id, { body_md: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Signatory name</Label>
                  <Input
                    value={t.signatory_name ?? ""}
                    onChange={(e) => updateCertificate(t.id, { signatory_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Signatory role</Label>
                  <Input
                    value={t.signatory_role ?? ""}
                    onChange={(e) => updateCertificate(t.id, { signatory_role: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Accent colour</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-9 w-16 p-1"
                    value={t.accent_color ?? "#7c3aed"}
                    onChange={(e) => updateCertificate(t.id, { accent_color: e.target.value })}
                  />
                  <Input
                    value={t.accent_color ?? "#7c3aed"}
                    onChange={(e) => updateCertificate(t.id, { accent_color: e.target.value })}
                  />
                </div>
              </div>
              <CertificateDesignEditor
                design={t}
                onChange={(patch) => updateCertificate(t.id, patch)}
              />
              <PreviewDialog
                open={openPreviewId === t.id}
                onOpenChange={(o) => setOpenPreviewId(o ? t.id : null)}
              >
                <PreviewTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>
                </PreviewTrigger>
                <PreviewContent className="max-w-4xl">
                  <PreviewHeader>
                    <PreviewTitle>Certificate preview</PreviewTitle>
                  </PreviewHeader>
                  {t.background_path ? (
                    <CertificateDesignPreview design={t} />
                  ) : (
                    <CertificatePreview template={t} courseTitle={course.title} />
                  )}
                </PreviewContent>
              </PreviewDialog>
            </div>
            <div>
              {t.background_path ? (
                <CertificateDesignPreview design={t} />
              ) : (
                <CertificatePreview template={t} courseTitle={course.title} />
              )}
            </div>
          </div>
        ))}
        <div className="flex justify-end pt-2">
          <Button disabled={save.isPending} onClick={saveAll}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save additional certificates
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LanguagesEditor({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fn = updateCourseConfig;
  const save = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Languages updated");
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const selected = new Set(course.supported_languages ?? ["en"]);
  function toggle(v: string) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    if (next.size === 0) next.add("en");
    save.mutate({
      course_id: course.id,
      supported_languages: Array.from(next),
    });
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => toggle(l.value)}
          className={`rounded-full border px-3 py-1 text-xs ${selected.has(l.value) ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function PartnersTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fnList = listInvites;
  const fnCreate = createInvite;
  const fnRevoke = revokeInvite;
  const fnSend = sendPartnerLoginLink;
  const q = useQuery({
    queryKey: ["lp-invites", course.id],
    queryFn: () => fnList({ course_id: course.id }),
  });
  const [form, setForm] = useState({
    recipient_name: "",
    recipient_email: "",
    kitchen_location: "",
    message: "",
  });
  const create = useMutation({
    mutationFn: async (payload: {
      course_id: string;
      recipient_name: string;
      recipient_email: string;
      kitchen_location?: string;
      message?: string;
    }) => {
      const invite = await fnCreate(payload);
      const result = await fnSend({ invite_id: invite.id });
      return { invite, result };
    },
    onSuccess: ({ result }) => {
      toast.success(
        result.emailed
          ? `Invite email sent to ${result.email}`
          : `Invite created for ${result.email}`,
      );
      qc.invalidateQueries({ queryKey: ["lp-invites", course.id] });
      setForm({
        recipient_name: "",
        recipient_email: "",
        kitchen_location: "",
        message: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: fnRevoke,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["lp-invites", course.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function inviteLink(token: string) {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/learn?invite=${token}`;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite a partner</CardTitle>
          <CardDescription>
            Sends a personal enrolment link. Status updates appear in the
            timeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Partner name</Label>
            <Input
              value={form.recipient_name}
              onChange={(e) =>
                setForm({ ...form, recipient_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={form.recipient_email}
              onChange={(e) =>
                setForm({ ...form, recipient_email: e.target.value })
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Kitchen location</Label>
            <Input
              value={form.kitchen_location}
              onChange={(e) =>
                setForm({ ...form, kitchen_location: e.target.value })
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Personal message (optional)</Label>
            <Textarea
              rows={2}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button
              disabled={
                !form.recipient_name ||
                !form.recipient_email ||
                create.isPending
              }
              onClick={() => create.mutate({ course_id: course.id, ...form })}
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Create invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Invites ({q.data?.length ?? 0})
          </CardTitle>
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
                  {inv.recipient_name} ·{" "}
                  <span className="text-muted-foreground">
                    {inv.recipient_email}
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
                    ? "Accepted"
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
