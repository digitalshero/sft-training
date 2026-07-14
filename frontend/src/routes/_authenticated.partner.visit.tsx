import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { StageShell } from "@/components/partner/stage-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeET } from "@/lib/datetime-et";
import {
  Award,
  Calendar,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Loader2,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { getMyPhysicalVisit } from "@/lib/sft/physical-visit.functions";
import type { PhysicalVisitRow } from "@/lib/sft/physical-visit.functions";
import { useClearNotificationsOnVisit } from "@/lib/partner/notifications.functions";

export const Route = createFileRoute("/_authenticated/partner/visit")({
  component: PartnerVisitPage,
});

function VisitHero() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden flex items-start gap-5 rounded-3xl border border-white/40 bg-linear-to-br from-success/10 via-white/60 to-transparent p-6 md:p-8 shadow-lg backdrop-blur-xl transition-shadow hover:shadow-2xl"
    >
      <motion.div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-success/20 blur-2xl"
        animate={{ x: [0, -15, 0], y: [0, 10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="hidden shrink-0 sm:block relative z-10">
        <motion.div 
          className="grid h-20 w-20 place-items-center rounded-full bg-success/20 shadow-inner"
          animate={{ rotate: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="grid h-11 w-11 place-items-center rounded-full bg-success text-white shadow-md">
            <CalendarCheck className="h-5 w-5" />
          </div>
        </motion.div>
      </div>
      <div className="relative z-10">
        <span className="inline-flex items-center rounded-full bg-success/20 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-success shadow-sm">
          Step 4 of 5
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Physical Visit &amp; Tasting
        </h1>
        <motion.div 
          className="mt-2 h-1 rounded-full bg-success" 
          initial={{ width: 0 }}
          animate={{ width: 40 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        />
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your trainer will visit the kitchen, inspect setup, and taste the
          product.
        </p>
      </div>
    </motion.div>
  );
}

function PartnerVisitPage() {
  // Clear any Physical Visit notifications as soon as the partner visits this
  // page — they're seeing the comment/decision right here, so it shouldn't
  // keep sitting as an unread badge just because they never opened the bell.
  useClearNotificationsOnVisit("physical_visit");

  const fn = getMyPhysicalVisit;
  const q = useQuery<PhysicalVisitRow | null>({
    queryKey: ["my-physical-visit"],
    queryFn: () => fn(),
  });

  return (
    <StageShell
      stage="visit"
      title="Physical Visit & Tasting"
      subtitle="Your trainer will visit the kitchen, inspect setup, and taste the product."
      heroSlot={<VisitHero />}
    >
      {() => {
        if (q.isLoading) {
          return (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </CardContent>
            </Card>
          );
        }

        const visit = q.data;

        if (!visit) {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4" /> Physical Visit
                </CardTitle>
                <CardDescription>
                  Your Physical Kitchen Visit will be scheduled once your Learn
                  &amp; Cook submission has been approved by the Admin.
                </CardDescription>
              </CardHeader>
            </Card>
          );
        }

        const scheduled = !!visit.visit_date;
        const decision = visit.decision ?? null;
        const pastAttempts = [...(visit.history ?? [])].sort(
          (a, b) => b.attempt_no - a.attempt_no,
        );

        return (
          <div className="space-y-5">
            <Card className="overflow-hidden rounded-2xl p-0">
              <div className="grid md:grid-cols-[minmax(220px,32%)_1fr]">
                <div className="flex flex-col gap-4 bg-success/5 p-6">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-success text-white">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-success">
                      {scheduled ? "Visit Scheduled" : prettyStatus(visit.status)}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {scheduled
                        ? "Your Physical Kitchen Visit has been scheduled. Please get ready with your assigned dish before the visitor arrives. Ensure your kitchen is clean and ready for inspection."
                        : "Your Physical Kitchen Visit will be scheduled once your Learn & Cook submission has been approved by the Admin."}
                    </p>
                  </div>
                  <div className="mt-auto hidden justify-center pt-4 sm:flex">
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-success/10">
                      <UtensilsCrossed className="h-10 w-10 text-success/40" />
                    </div>
                  </div>
                </div>

                <div className="relative p-6">
                  {decision === "approved" && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute right-6 top-6"
                    >
                      <Badge className="gap-1 bg-success/15 text-success border-success/30 relative">
                        <motion.span 
                          className="absolute inset-0 rounded-full border border-success/50"
                          animate={{ scale: [1, 1.4, 1], opacity: [1, 0, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <ClipboardCheck className="h-3 w-3 relative z-10" /> <span className="relative z-10">Certified</span>
                      </Badge>
                    </motion.div>
                  )}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <InfoField
                      icon={User}
                      label="Partner"
                      value={visit.partner_name ?? "—"}
                    />
                    <InfoField
                      icon={ClipboardList}
                      label="Assigned Products"
                      value={
                        visit.assigned_products.length
                          ? visit.assigned_products.join(", ")
                          : "—"
                      }
                    />
                    <InfoField
                      icon={User}
                      label="Visitor / Trainer"
                      value={visit.visitor_name ?? "Not assigned yet"}
                    />
                    <InfoField
                      icon={Calendar}
                      label="Visit Date"
                      value={visit.visit_date ?? "—"}
                    />
                    <InfoField
                      icon={Clock}
                      label="Visit Time"
                      value={visit.visit_time ?? "—"}
                    />
                  </div>

                  {decision && (
                    <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-muted/30 p-4">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Final Decision
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              decision === "approved"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                            }
                          >
                            {decision}
                          </Badge>
                          {(visit.decision_comments ?? visit.remarks) && (
                            <span className="text-sm text-muted-foreground">
                              {visit.decision_comments ?? visit.remarks}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="hidden shrink-0 sm:block">
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
                          <Award className="h-6 w-6" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {pastAttempts.length > 0 && (
              <Card className="rounded-2xl">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success text-white">
                      <ClipboardList className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Your Attempts
                      </CardTitle>
                      <CardDescription>
                        What you cooked and submitted for each visit attempt.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pastAttempts.map((h, i) => (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="space-y-2 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-sm backdrop-blur-md transition-all hover:shadow-md hover:border-primary/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ClipboardList className="h-4 w-4 text-success" />
                          Attempt {h.attempt_no}
                        </div>
                        {h.decision && (
                          <Badge
                            variant="outline"
                            className={
                              h.decision === "approved"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                            }
                          >
                            {h.decision}
                          </Badge>
                        )}
                      </div>
                      {h.submitted_at && (
                        <div className="text-xs text-muted-foreground">
                          Submitted {formatDateTimeET(h.submitted_at)}
                        </div>
                      )}
                      {h.assigned_products.length > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">
                            Products cooked:{" "}
                          </span>
                          {h.assigned_products.join(", ")}
                        </div>
                      )}
                      {h.comments && (
                        <div className="text-xs text-muted-foreground">
                          {h.comments}
                        </div>
                      )}
                      {h.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {h.photos.map(
                            (p) =>
                              p.signed_url && (
                                <img
                                  key={p.id}
                                  src={p.signed_url}
                                  alt={p.caption ?? ""}
                                  className="h-20 w-20 rounded-xl border border-border object-cover sm:h-24 sm:w-24"
                                />
                              ),
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        );
      }}
    </StageShell>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function prettyStatus(s: string) {
  const map: Record<string, string> = {
    eligible: "Eligible",
    visitor_assigned: "Visitor Assigned",
    visit_scheduled: "Visit Scheduled",
    email_sent: "Email Sent",
    form_pending: "Form Pending",
    form_submitted: "Form Submitted",
    visit_completed: "Visit Completed",
    approved: "Approved",
    rejected: "Rejected",
  };
  return map[s] ?? s;
}
