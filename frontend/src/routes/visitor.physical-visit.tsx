import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Send,
  Trash2,
  Upload,
  User,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  VisitorPortalData,
  PhysicalVisitPhoto,
  ProductInspectionStatus,
} from "@/lib/sft/physical-visit.functions";

export const Route = createFileRoute("/visitor/physical-visit")({
  head: () => ({ meta: [{ title: "Physical Visit Portal — Shero" }] }),
  component: VisitorPortalPage,
});

const APPROVAL_THRESHOLD = 80;

type ProductState = {
  status: ProductInspectionStatus;
  comment: string;
};

function VisitorPortalPage() {
  const token =
    new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ).get("token") ?? "";
  const [data, setData] = useState<VisitorPortalData | null>(null);
  const [photos, setPhotos] = useState<PhysicalVisitPhoto[]>([]);
  const [productState, setProductState] = useState<Record<string, ProductState>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );
  const [decisionTouched, setDecisionTouched] = useState(false);
  const [comment, setComment] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorLocation, setVisitorLocation] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${BASE}/public/physical-visit?token=${token}`)
      .then((r) => r.json())
      .then((d: VisitorPortalData) => {
        setData(d);
        setPhotos(d.photos ?? []);
        setVisitorName(d.visitor_name ?? "");
        setVisitorLocation(d.visitor_location ?? "");
        const initial: Record<string, ProductState> = {};
        for (const p of d.assigned_products ?? []) {
          const existing = d.product_inspections?.find(
            (i) => i.product_id === p.product_id,
          );
          initial[p.product_id] = {
            status: existing?.status ?? "pending",
            comment: existing?.comment ?? "",
          };
        }
        setProductState(initial);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, BASE]);

  const products = data?.assigned_products ?? [];
  const totalProducts = products.length;
  const acceptedCount = products.filter(
    (p) => productState[p.product_id]?.status === "accepted",
  ).length;
  const rejectedCount = products.filter(
    (p) => productState[p.product_id]?.status === "rejected",
  ).length;
  const reviewedCount = acceptedCount + rejectedCount;
  const allReviewed = totalProducts > 0 && reviewedCount === totalProducts;
  const inspectionPercentage =
    totalProducts > 0 ? Math.round((acceptedCount / totalProducts) * 100) : 0;
  const eligible = inspectionPercentage >= APPROVAL_THRESHOLD;

  // Auto-suggest a Final Decision once every product has been reviewed, but
  // never override a choice the visitor already made themselves.
  useEffect(() => {
    if (allReviewed && !decisionTouched) {
      setDecision(eligible ? "approved" : "rejected");
    }
  }, [allReviewed, eligible, decisionTouched]);

  const handleUpload = async (
    productId: string | null,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const refKey = productId ?? "general";
    setUploadingFor(refKey);
    const form = new FormData();
    form.append("file", file);
    if (productId) form.append("product_id", productId);
    try {
      const r = await fetch(
        `${BASE}/public/physical-visit/upload?token=${token}`,
        { method: "POST", body: form },
      );
      const photo = await r.json();
      if (!r.ok) throw new Error(photo.error ?? "Upload failed");
      setPhotos((p) => [...p, photo]);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingFor(null);
      const input = fileRefs.current[refKey];
      if (input) input.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(
      `${BASE}/public/physical-visit/upload?token=${token}&photo_id=${id}`,
      { method: "DELETE" },
    );
    setPhotos((p) => p.filter((ph) => ph.id !== id));
  };

  const persistProductStatus = async (
    productId: string,
    productName: string,
    next: ProductState,
  ) => {
    setProductState((s) => ({ ...s, [productId]: next }));
    setDecisionTouched(false); // let the eligibility suggestion re-derive
    try {
      await fetch(`${BASE}/public/physical-visit/product-status?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          product_id: productId,
          product_name: productName,
          status: next.status,
          comment: next.comment || undefined,
        }),
      });
    } catch {
      // best-effort; the value is re-sent whenever the visitor touches the card again
    }
  };

  const handleSubmit = async () => {
    if (!visitorName.trim()) {
      toast.error("Visitor name is required");
      return;
    }
    if (totalProducts > 0 && !allReviewed) {
      toast.error("Accept or reject every assigned product first");
      return;
    }
    if (totalProducts === 0 && photos.length === 0) {
      toast.error("Upload at least one photo");
      return;
    }
    if (!decision) {
      toast.error("Please select Approve or Reject");
      return;
    }
    if (decision === "rejected" && !comment.trim()) {
      toast.error("Please provide a comment when rejecting");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${BASE}/public/physical-visit/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          decision,
          comments: comment.trim() || undefined,
          visitor_name: visitorName.trim(),
          visitor_location: visitorLocation.trim() || undefined,
        }),
      });
      const res = await r.json();
      if (!r.ok) throw new Error(res.error);
      setSubmitted(true);
      toast.success(
        decision === "approved"
          ? "Visit approved!"
          : "Visit marked as rejected.",
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  if (!token || !data)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Invalid or expired portal link.
        </p>
      </div>
    );
  if (submitted || data.already_submitted)
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card-surface max-w-md p-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-green-500" />
          <h1 className="text-xl font-semibold">Submitted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your visit report has been submitted. Thank you!
          </p>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-success/10 text-success">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Physical Visit Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Attempt #{data.attempt_no} · Inspect every assigned product and
            complete all fields before submitting.
          </p>
        </div>
      </div>

      {/* Visitor Information */}
      <section className="card-surface space-y-4 p-5">
        <SectionHeading icon={User} title="Visitor Information" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Visitor Name *</label>
            <input
              type="text"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Visitor Location *</label>
            <input
              type="text"
              value={visitorLocation}
              onChange={(e) => setVisitorLocation(e.target.value)}
              placeholder="e.g. Chennai, Tamil Nadu"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success"
            />
          </div>
        </div>
      </section>

      {/* Partner Information */}
      <section className="card-surface space-y-3 p-5">
        <SectionHeading icon={Building2} title="Partner Information" />
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <InfoRow label="Partner Name" value={data.partner_name} />
          <InfoRow label="Location" value={data.partner_location} />
          {data.partner_state && (
            <InfoRow label="State" value={data.partner_state} />
          )}
          {data.partner_country && (
            <InfoRow label="Country" value={data.partner_country} />
          )}
        </div>
        <div className="border-t border-border pt-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-success" />
            <span className="w-24 shrink-0 font-medium">Visit Date</span>
            <span className="text-muted-foreground">
              {data.visit_date} at {data.visit_time}
            </span>
          </div>
          {data.cuisine_name && (
            <div className="mt-2 flex gap-2">
              <span className="w-28 shrink-0 font-medium">Cuisine</span>
              <span className="text-muted-foreground">{data.cuisine_name}</span>
            </div>
          )}
          {products.length > 0 && (
            <div className="mt-2 flex gap-2">
              <span className="w-28 shrink-0 font-medium">Products</span>
              <span className="text-muted-foreground">
                {products.map((p, i) => `${i + 1}. ${p.product_name}`).join("  ")}
              </span>
            </div>
          )}
          {data.remarks && (
            <div className="mt-2 flex gap-2">
              <span className="w-28 shrink-0 font-medium">Remarks</span>
              <span className="text-muted-foreground">{data.remarks}</span>
            </div>
          )}
        </div>
      </section>

      {/* Per-product inspection cards */}
      {products.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading icon={ClipboardCheck} title="Product Inspection *" />
          {products.map((p) => {
            const st = productState[p.product_id] ?? {
              status: "pending" as ProductInspectionStatus,
              comment: "",
            };
            const productPhotos = photos.filter(
              (ph) => ph.product_id === p.product_id,
            );
            return (
              <div
                key={p.product_id}
                className="card-surface space-y-3 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{p.product_name}</h3>
                  {st.status !== "pending" && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        st.status === "accepted"
                          ? "bg-success/10 text-success"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {st.status === "accepted" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {st.status === "accepted" ? "Accepted" : "Rejected"}
                    </span>
                  )}
                </div>

                {productPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {productPhotos.map((ph) => (
                      <div
                        key={ph.id}
                        className="relative overflow-hidden rounded-lg border border-border"
                      >
                        {ph.signed_url && (
                          <img
                            src={ph.signed_url}
                            alt={p.product_name}
                            className="h-20 w-full object-cover"
                          />
                        )}
                        <button
                          onClick={() => handleDelete(ph.id)}
                          className="absolute right-1 top-1 rounded bg-background/80 p-0.5 text-destructive hover:bg-background"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-success/50">
                  {uploadingFor === p.product_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {productPhotos.length === 0 ? "Upload photo" : "Add another"}
                  <input
                    ref={(el) => {
                      fileRefs.current[p.product_id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleUpload(p.product_id, e)}
                    disabled={uploadingFor === p.product_id}
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      persistProductStatus(p.product_id, p.product_name, {
                        ...st,
                        status: "accepted",
                      })
                    }
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-colors ${
                      st.status === "accepted"
                        ? "border-success bg-success/10 text-success"
                        : "border-border bg-background hover:border-success/40"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      persistProductStatus(p.product_id, p.product_name, {
                        ...st,
                        status: "rejected",
                      })
                    }
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-colors ${
                      st.status === "rejected"
                        ? "border-rose-600 bg-rose-50 text-rose-700"
                        : "border-border bg-background hover:border-rose-300"
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={st.comment}
                  onChange={(e) =>
                    setProductState((s) => ({
                      ...s,
                      [p.product_id]: { ...st, comment: e.target.value },
                    }))
                  }
                  onBlur={() =>
                    persistProductStatus(p.product_id, p.product_name, st)
                  }
                  placeholder="Comments about this product (optional)"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-success"
                />
              </div>
            );
          })}
        </section>
      ) : (
        <section className="card-surface space-y-3 p-5">
          <SectionHeading icon={Camera} title="Kitchen Photos *" />
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((ph) => (
                <div
                  key={ph.id}
                  className="relative overflow-hidden rounded-lg border border-border"
                >
                  {ph.signed_url && (
                    <img
                      src={ph.signed_url}
                      alt={ph.caption ?? ""}
                      className="h-32 w-full object-cover"
                    />
                  )}
                  <button
                    onClick={() => handleDelete(ph.id)}
                    className="absolute right-1 top-1 rounded bg-background/80 p-1 text-destructive hover:bg-background"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90">
            {uploadingFor === "general" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {photos.length === 0 ? "Upload photo" : "Add another photo"}
            <input
              ref={(el) => {
                fileRefs.current.general = el;
              }}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleUpload(null, e)}
              disabled={uploadingFor === "general"}
            />
          </label>
        </section>
      )}

      {/* Inspection score */}
      {totalProducts > 0 && (
        <section className="card-surface flex items-center gap-5 p-5">
          <InspectionScoreRing percentage={inspectionPercentage} />
          <div>
            <p className="text-sm font-semibold">Inspection Score</p>
            <p className="text-xs text-muted-foreground">
              {acceptedCount}/{totalProducts} products approved
            </p>
            {allReviewed ? (
              <span
                className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  eligible
                    ? "bg-success/10 text-success"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {eligible ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {eligible ? "Eligible for Approval" : "Below Required Standard"}
              </span>
            ) : (
              <span className="mt-2 inline-block text-xs text-muted-foreground">
                {reviewedCount}/{totalProducts} reviewed so far
              </span>
            )}
          </div>
        </section>
      )}

      {/* Final Decision */}
      <section className="card-surface p-5 space-y-4">
        <SectionHeading icon={ClipboardCheck} title="Final Decision *" />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setDecision("approved");
              setDecisionTouched(true);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors ${
              decision === "approved"
                ? "border-success bg-success/10 text-success"
                : "border-border bg-background text-foreground hover:border-success/40"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve & Submit
          </button>
          <button
            type="button"
            onClick={() => {
              setDecision("rejected");
              setDecisionTouched(true);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-colors ${
              decision === "rejected"
                ? "border-rose-600 bg-rose-50 text-rose-700"
                : "border-border bg-background text-foreground hover:border-rose-300"
            }`}
          >
            <XCircle className="h-4 w-4" />
            Reject & Submit
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">
            Final Comments {decision === "rejected" ? "*" : "(optional)"}
          </label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              decision === "rejected"
                ? "Required — explain the reason for rejection"
                : "Optional — any observations or notes about the kitchen visit"
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success"
          />
          <p className="text-xs text-muted-foreground">
            Comments are visible to both the partner and admin.
          </p>
        </div>
      </section>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !decision}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-success py-3 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Submit Report
      </button>
    </div>
  );
}

function InspectionScoreRing({ percentage }: { percentage: number }) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = useMemo(
    () => circumference - (percentage / 100) * circumference,
    [circumference, percentage],
  );
  const color = percentage >= APPROVAL_THRESHOLD ? "var(--success)" : "#e11d48";
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke="var(--border)"
        strokeWidth="8"
      />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 38 38)"
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text
        x="38"
        y="42"
        textAnchor="middle"
        className="text-sm font-bold"
        style={{ fill: "var(--foreground)" }}
      >
        {percentage}%
      </text>
    </svg>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-success">
      <Icon className="h-4 w-4" />
      {title}
    </h2>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}
