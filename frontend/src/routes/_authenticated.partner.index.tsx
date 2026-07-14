import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import {
  getPartnerDashboard,
  getPartnerInsights,
  type PartnerCertificate,
} from "@/lib/partner/partner.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CelebrationDialog,
  celebrationButtonClass,
} from "@/components/partner/celebration-dialog";
import { downloadCertificatePdf } from "@/lib/partner/certificate-pdf";
import { useAnimatedPercent } from "@/hooks/use-animated-percent";
import { timeAgo } from "@/lib/time-ago";
import {
  Activity,
  Award,
  BookOpen,
  Camera,
  ChefHat,
  ChevronRight,
  Download,
  Flame,
  Loader2,
  MapPin,
  PlayCircle,
  Sparkles,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/partner/")({
  component: PartnerHubPage,
});

const ACTIVITY_ICON: Record<string, React.ElementType> = {
  module: BookOpen,
  cuisine: ChefHat,
  submission: Camera,
  visit: MapPin,
  certificate: Award,
};

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

/** Sweeping highlight overlay for premium CTA buttons. Purely decorative. */
function ShineOverlay() {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-20deg] bg-white/25"
      initial={{ left: "-40%" }}
      animate={{ left: "130%" }}
      transition={{
        duration: 1.3,
        repeat: Infinity,
        repeatDelay: 2.4,
        ease: "easeInOut",
      }}
    />
  );
}

function PartnerHubPage() {
  const navigate = useNavigate();
  const fnDash = getPartnerDashboard;
  const dashQ = useQuery({
    queryKey: ["partner-dash"],
    queryFn: () => fnDash(),
  });
  const insightsQ = useQuery({
    queryKey: ["partner-insights"],
    queryFn: () => getPartnerInsights(),
  });

  const data = dashQ.data;
  const primaryInvite = data?.invites[0];

  const [celebrate, setCelebrate] = useState<PartnerCertificate | null>(null);
  useEffect(() => {
    if (!data?.certificates?.length) return;
    if (typeof window === "undefined") return;
    const unseen = data.certificates.find(
      (c) => !window.localStorage.getItem(`shero:cert-celebrated:${c.id}`),
    );
    if (unseen) setCelebrate(unseen);
  }, [data?.certificates]);

  const dismissCelebrate = () => {
    if (celebrate && typeof window !== "undefined") {
      window.localStorage.setItem(`shero:cert-celebrated:${celebrate.id}`, "1");
    }
    setCelebrate(null);
  };

  const prog = primaryInvite
    ? (data!.progress[primaryInvite.course_id] ?? {
        modules_total: 0,
        modules_done: 0,
        submission_status: null,
      })
    : { modules_total: 0, modules_done: 0, submission_status: null };
  const pct = prog.modules_total
    ? Math.round((prog.modules_done / prog.modules_total) * 100)
    : 0;
  const animatedPct = useAnimatedPercent(pct);

  // All 5 days finished and Prepare & Cook hasn't been started yet — let the
  // partner know the next stage just unlocked, once per course.
  const [cookUnlock, setCookUnlock] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !primaryInvite) return;
    if (pct !== 100 || prog.submission_status) return;
    const key = `shero:cook-unlocked:${primaryInvite.course_id}`;
    if (window.localStorage.getItem(key)) return;
    setCookUnlock(true);
  }, [pct, prog.submission_status, primaryInvite]);

  const dismissCookUnlock = () => {
    if (primaryInvite && typeof window !== "undefined") {
      window.localStorage.setItem(
        `shero:cook-unlocked:${primaryInvite.course_id}`,
        "1",
      );
    }
    setCookUnlock(false);
  };

  if (dashQ.isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  if (dashQ.isSuccess && data!.invites.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-10 text-center text-sm text-muted-foreground">
          You do not have an active invite yet. Please check with your trainer.
        </Card>
      </div>
    );
  }

  if (!data || !primaryInvite) return null;

  const cert = data.certificates.find(
    (c) => c.course_id === primaryInvite.course_id,
  );
  const subStatus = prog.submission_status;
  const insights = insightsQ.data;

  const timelineSteps = [
    { label: "SFT Technology", icon: BookOpen, done: pct === 100 },
    { label: "Cuisines & Menu", icon: ChefHat, done: !!subStatus },
    { label: "Photo & Upload", icon: Camera, done: subStatus === "approved" },
    { label: "Physical Visit", icon: MapPin, done: !!cert },
    { label: "Certificate", icon: Award, done: !!cert },
  ];
  const currentStepIdx = timelineSteps.findIndex((s) => !s.done);

  const quickActions = [
    {
      label: "Learn Course",
      subtitle: `${prog.modules_done}/${prog.modules_total} modules`,
      icon: BookOpen,
      to: "/learn/$courseId" as const,
      params: { courseId: primaryInvite.course_id },
      progressPct: pct,
    },
    {
      label: "Prepare & Cook",
      subtitle: subStatus ? `Status: ${subStatus}` : "Not started",
      icon: ChefHat,
      to: "/partner/cook" as const,
      params: undefined,
      progressPct: subStatus === "approved" ? 100 : subStatus ? 50 : 0,
    },
    {
      label: "Physical Visit",
      subtitle: cert ? "Completed" : "Track status",
      icon: MapPin,
      to: "/partner/visit" as const,
      params: undefined,
      progressPct: cert ? 100 : 0,
    },
  ];

  const firstName = primaryInvite.recipient_name.split(" ")[0];

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col overflow-y-auto lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
      {/* Soft teal background: gradient wash + drifting blobs + dotted texture + geometric shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-linear-to-br from-primary/5 via-transparent to-shero-gold/5">
        <motion.div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
          animate={{ x: [0, 24, 0], y: [0, 16, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-10 top-1/3 h-56 w-56 rounded-full bg-shero-emerald/10 blur-3xl"
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-shero-gold/10 blur-3xl"
          animate={{ x: [0, 18, 0], y: [0, -18, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(13,148,136,0.12) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="absolute right-[22%] top-10 h-40 w-40 rotate-12 rounded-3xl border border-primary/10" />
        <div className="absolute bottom-12 left-[20%] h-32 w-32 -rotate-6 rounded-full border border-shero-gold/15" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 grid flex-1 grid-cols-1 gap-3 p-3 md:p-4 lg:grid-cols-[70%_1fr]"
      >
        {/* Center column */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Hero */}
          <motion.div variants={itemVariants} whileHover={{ scale: 1.01 }} className="flex flex-1 transition-transform">
            <Card className="relative flex w-full items-center justify-between gap-5 overflow-hidden rounded-3xl border border-white/40 bg-linear-to-br from-primary/10 via-white/60 to-shero-gold/10 px-6 py-5 shadow-xl backdrop-blur-xl transition-shadow hover:shadow-2xl">
              <motion.div
                className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
                animate={{ x: [0, 10, 0], y: [0, 8, 0] }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="relative min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Partner Hub
                </p>
                <h1 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-tight">
                  Welcome, {firstName}! 👋
                </h1>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Continue your training journey and take the next step towards
                  becoming a successful Shero Partner.
                </p>
                <div className="relative mt-4 inline-block">
                  <Button asChild className="relative overflow-hidden">
                    <Link
                      to="/learn/$courseId"
                      params={{ courseId: primaryInvite.course_id }}
                    >
                      <PlayCircle className="h-4 w-4" />{" "}
                      {prog.modules_done > 0 ? "Continue Learning" : "Open Course"}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <ShineOverlay />
                </div>
              </div>

              <div className="relative hidden shrink-0 sm:block">
                {/* Decorative glass illustration */}
                <div className="absolute inset-0 -m-8 rounded-full bg-linear-to-br from-primary/20 to-shero-gold/20 blur-xl" />
                <HeroCircularProgress pct={animatedPct} />
              </div>
            </Card>
          </motion.div>

          {/* Timeline */}
          <motion.div variants={itemVariants} className="flex flex-1">
            <Card className="flex w-full flex-col justify-center gap-4 rounded-3xl border border-white/40 bg-white/60 px-5 py-5 shadow-lg backdrop-blur-xl">
              <h2 className="font-display text-base font-semibold">
                Your Course Steps
              </h2>
              <div className="relative flex items-center">
                <div className="absolute left-[6%] right-[6%] top-5 h-0 border-t-[3px] border-dashed border-border" />
                {timelineSteps.map((s, i) => {
                  const state =
                    i === currentStepIdx || (currentStepIdx === -1 && !s.done)
                      ? "in_progress"
                      : s.done
                        ? "done"
                        : "pending";
                  return (
                    <div
                      key={s.label}
                      className="relative z-10 flex-1 text-center"
                    >
                      <motion.div
                        className={`mx-auto grid h-10 w-10 place-items-center rounded-full border-2 bg-card ${
                          state === "done"
                            ? "border-primary text-primary shadow-[0_0_14px_rgba(13,148,136,0.35)]"
                            : state === "in_progress"
                              ? "border-amber-400 text-amber-600"
                              : "border-border text-muted-foreground"
                        }`}
                        whileHover={{ scale: 1.12, y: -2 }}
                        animate={
                          state === "in_progress"
                            ? {
                                boxShadow: [
                                  "0 0 0px rgba(217,119,6,0.0)",
                                  "0 0 12px rgba(217,119,6,0.5)",
                                  "0 0 0px rgba(217,119,6,0.0)",
                                ],
                              }
                            : undefined
                        }
                        transition={
                          state === "in_progress"
                            ? {
                                duration: 1.8,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }
                            : { type: "spring", stiffness: 300 }
                        }
                      >
                        <s.icon className="h-4 w-4" />
                      </motion.div>
                      <p className="mt-2 text-xs font-medium leading-tight">
                        {s.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* Quick actions */}
          <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch gap-3">
            {quickActions.map((a) => (
              <motion.div
                key={a.label}
                variants={itemVariants}
                whileHover={{ y: -6, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                className="flex"
              >
                <Link to={a.to} params={a.params} className="block w-full">
                  <Card className="group relative flex h-full w-full flex-col justify-center gap-2 overflow-hidden rounded-3xl border border-white/40 bg-white/60 p-4 shadow-lg backdrop-blur-xl transition-all hover:border-primary/30 hover:shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-primary/0 transition-colors duration-500 group-hover:from-primary/10 group-hover:to-shero-gold/10" />
                    <div className="relative flex items-center justify-between z-10">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                        <a.icon className="h-4 w-4" />
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <div className="relative z-10">
                      <p className="text-sm font-semibold">{a.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.subtitle}
                      </p>
                    </div>
                    <div className="relative z-10 h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-700"
                        style={{ width: `${a.progressPct}%` }}
                      />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right insights panel */}
        <div className="flex min-h-0 flex-col gap-3">
          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6 }}
            className="flex min-h-0 flex-1"
          >
            <Card className="group relative flex h-full w-full flex-col justify-center gap-2 overflow-hidden rounded-3xl border border-white/40 bg-white/60 p-4 shadow-lg backdrop-blur-xl transition-all hover:border-primary/30 hover:shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-primary/0 transition-colors duration-500 group-hover:from-primary/5 group-hover:to-primary/5" />
              <div className="relative z-10 flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <Target className="h-4 w-4" />
                </div>
                <p className="text-base font-semibold">Today's Goal</p>
              </div>
              {insightsQ.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-sm leading-snug text-muted-foreground">
                  {insights?.today_goal?.label ?? "You're all caught up!"}
                </p>
              )}
            </Card>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6 }}
            className="flex min-h-0 flex-1"
          >
            <Card className="relative flex h-full w-full flex-col justify-center gap-2 overflow-hidden rounded-3xl border border-white/40 bg-linear-to-br from-primary to-shero-emerald p-4 text-primary-foreground shadow-lg">
              <motion.div
                className="pointer-events-none absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div className="relative flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15">
                  <Flame className="h-4 w-4 text-shero-gold" />
                </div>
                <p className="text-base font-semibold">Learning Streak</p>
              </div>
              <p className="relative text-2xl font-bold">
                {insightsQ.isLoading ? "—" : (insights?.streak_days ?? 0)}{" "}
                <span className="text-sm font-normal text-primary-foreground/80">
                  day{insights?.streak_days === 1 ? "" : "s"}
                </span>
              </p>
            </Card>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6 }}
            className="flex min-h-0 flex-1"
          >
            <Card className="group relative flex h-full w-full flex-col justify-center gap-2 overflow-hidden rounded-3xl border border-white/40 bg-white/60 p-4 shadow-lg backdrop-blur-xl transition-all hover:border-shero-gold/30 hover:shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-shero-gold/0 via-transparent to-shero-gold/0 transition-colors duration-500 group-hover:from-shero-gold/5 group-hover:to-shero-gold/10" />
              <div className="relative z-10 flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-shero-gold/20 text-shero-gold">
                  <Award className="h-4 w-4" />
                </div>
                <p className="text-base font-semibold">Certificate Status</p>
              </div>
              {cert ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    downloadCertificatePdf({
                      course_title: cert.course_title,
                      code: cert.code,
                      issued_at: cert.issued_at,
                      recipient_name: primaryInvite.recipient_name,
                    })
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not yet certified — {pct}% through training
                </p>
              )}
            </Card>
          </motion.div>

          <motion.div
            variants={itemVariants}
            whileHover={{ y: -6 }}
            className="flex min-h-0 flex-[1.6]"
          >
            <Card className="flex h-60 w-full flex-col rounded-3xl border border-white/40 bg-white/60 p-4 shadow-lg backdrop-blur-xl">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Activity className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">Recent Activity</p>
              </div>
              {insightsQ.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : insights?.recent_activity.length ? (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="flex-1 divide-y divide-border/50 overflow-y-auto"
                >
                  {insights.recent_activity.slice(0, 5).map((a) => {
                    const Icon = ACTIVITY_ICON[a.type] ?? Activity;
                    return (
                      <motion.div
                        key={a.id}
                        variants={itemVariants}
                        whileHover={{ x: 6, backgroundColor: "rgba(13,148,136,0.06)" }}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <Icon className="h-3 w-3" />
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">
                          {a.label}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {timeAgo(a.at)}
                        </span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No activity yet — get started!
                </p>
              )}
            </Card>
          </motion.div>
        </div>
      </motion.div>

      <CelebrationDialog
        open={!!celebrate}
        onOpenChange={(o) => !o && dismissCelebrate()}
        icon={Award}
        title="Congratulations!"
        description={
          <>
            Congrats on completing your physical visit and earning your Shero
            certificate for{" "}
            <span className="font-medium text-foreground">
              {celebrate?.course_title}
            </span>
            .
          </>
        }
        body="You can download your certificate now."
        footer={
          <>
            <Button
              variant="outline"
              className={celebrationButtonClass}
              onClick={dismissCelebrate}
            >
              Close
            </Button>
            <Button
              className={celebrationButtonClass}
              onClick={() => {
                if (!celebrate) return;
                downloadCertificatePdf({
                  course_title: celebrate.course_title,
                  code: celebrate.code,
                  issued_at: celebrate.issued_at,
                  recipient_name: primaryInvite.recipient_name,
                });
                dismissCelebrate();
              }}
            >
              <Download className="h-4 w-4" /> Download certificate
            </Button>
          </>
        }
      />

      <CelebrationDialog
        open={cookUnlock}
        onOpenChange={(o) => !o && dismissCookUnlock()}
        icon={ChefHat}
        title="Prepare & Cook unlocked!"
        description="You've finished all 5 learning days."
        body="Next up: pick your cuisines and upload photos of your dishes for review."
        footer={
          <>
            <Button
              variant="outline"
              className={celebrationButtonClass}
              onClick={dismissCookUnlock}
            >
              Later
            </Button>
            <Button
              className={celebrationButtonClass}
              onClick={() => {
                dismissCookUnlock();
                navigate({ to: "/partner/cook" });
              }}
            >
              <ChefHat className="h-4 w-4" /> Start Prepare & Cook
            </Button>
          </>
        }
      />
    </div>
  );
}

function HeroCircularProgress({ pct }: { pct: number }) {
  const size = 150;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="fill-none stroke-primary/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="fill-none stroke-primary"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{pct}%</span>
        <span className="text-[13px] text-muted-foreground">Completed</span>
      </div>
    </div>
  );
}
