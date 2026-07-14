import * as React from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import { useAnimatedPercent } from "@/hooks/use-animated-percent";
import { useClearNotificationsOnVisit } from "@/lib/partner/notifications.functions";
import {
  getCourse,
  myCourseState,
  myProductSubmission,
  type Course,
  type CourseModule,
  type CourseDay,
  type ModuleProgress,
} from "@/lib/learning/learning.functions";
import {
  listPartnerResources,
  listPartnerVideos,
} from "@/lib/partner/partner.functions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  ChefHat,
  Circle,
  Lock,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  GraduationCap,
  LogOut,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductUploadCard } from "@/components/learn/ProductUploadCard";
import { CertificateCard } from "@/components/learn/CertificateCard";
import { DownloadsSection } from "@/components/learn/DownloadsSection";
import { PageHero } from "@/components/partner/page-hero";
import { CelebrationDialog } from "@/components/partner/celebration-dialog";

export const Route = createFileRoute("/_authenticated/learn/$courseId")({
  component: CoursePage,
});

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

function CoursePage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  // If on /learn/:courseId/:moduleId, show child route only
  const inModule = pathname.split("/").length > 3;

  // Clear any certificate notifications as soon as the partner visits their
  // course page — they're seeing the update right here, so it shouldn't keep
  // sitting as an unread badge just because they never opened the bell.
  useClearNotificationsOnVisit("certificate");

  const fnCourse = getCourse;
  const fnState = myCourseState;
  const fnSub = myProductSubmission;
  const courseQ = useQuery<{
    course: Course;
    modules: CourseModule[];
    days: CourseDay[];
  }>({
    queryKey: ["lp-course-learner", courseId],
    queryFn: () => fnCourse({ course_id: courseId }),
  });
  const stateQ = useQuery<{ progress: ModuleProgress[] }>({
    queryKey: ["lp-course-state", courseId],
    queryFn: () => fnState({ courseId }),
    // A 403 "access expired" response is permanent, not transient — retrying
    // would just delay showing the expired screen for no benefit.
    retry: false,
  });
  const subQ = useQuery({
    queryKey: ["lp-product-sub", courseId],
    queryFn: () => fnSub({ courseId }),
  });
  const fnResources = listPartnerResources;
  const fnVideos = listPartnerVideos;
  const resourcesQ = useQuery({
    queryKey: ["lp-partner-resources", courseId],
    queryFn: () => fnResources({ course_id: courseId }),
  });
  const videosQ = useQuery({
    queryKey: ["lp-partner-videos", courseId],
    queryFn: () => fnVideos({ course_id: courseId }),
  });

  // Hooks must run unconditionally on every render, so compute a safe
  // percentage (0 while data is still loading) before any early returns below.
  const earlyDayModules = (courseQ.data?.modules ?? []).filter((m) => m.day_id);
  const earlyCompleted = earlyDayModules.filter((m) =>
    (stateQ.data?.progress ?? []).some(
      (p) => p.module_id === m.id && p.completed_at,
    ),
  ).length;
  const earlyPct = earlyDayModules.length
    ? Math.round((earlyCompleted / earlyDayModules.length) * 100)
    : 0;
  const animatedPct = useAnimatedPercent(earlyPct);

  // Day-completion celebration popup
  const [celebrateDay, setCelebrateDay] = React.useState<{
    dayNo: number;
    dayId: string;
    nextDayId: string | null;
    nextDayTitle: string | null;
    scorePct: number | null;
  } | null>(null);
  React.useEffect(() => {
    if (!courseQ.data || !stateQ.data) return;
    const { modules: mods, days: ds } = courseQ.data;
    const prog: ModuleProgress[] = stateQ.data.progress ?? [];
    const done = (id: string) =>
      prog.some((p: ModuleProgress) => p.module_id === id && p.completed_at);
    const ordered = [...ds].sort((a, b) => a.day_no - b.day_no);
    for (let i = 0; i < ordered.length; i++) {
      const d = ordered[i];
      const dayMods = mods.filter((m: CourseModule) => m.day_id === d.id);
      if (dayMods.length === 0) continue;
      const allComplete = dayMods.every((m: CourseModule) => done(m.id));
      if (!allComplete) continue;
      const key = `day-celebrated:${courseId}:${d.id}`;
      if (typeof window === "undefined" || sessionStorage.getItem(key))
        continue;
      const next = ordered[i + 1] ?? null;
      const scoreKey = `day-score:${courseId}:${d.id}`;
      const rawScore = sessionStorage.getItem(scoreKey);
      if (rawScore != null) sessionStorage.removeItem(scoreKey);
      setCelebrateDay({
        dayNo: d.day_no,
        dayId: d.id,
        nextDayId: next?.id ?? null,
        nextDayTitle: next?.title ?? null,
        scorePct: rawScore != null ? Number(rawScore) : null,
      });
      sessionStorage.setItem(key, "1");
      break;
    }
  }, [courseQ.data, stateQ.data, courseId]);

  // Access to a course ends 30 days after certification — checked in
  // /learning/courses/:courseId/my-state and applies before the module
  // outlet, so a direct link to a specific module is blocked too.
  const expired = Boolean(
    (stateQ.error as { response?: { data?: { expired?: boolean } } } | null)
      ?.response?.data?.expired,
  );
  if (expired) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 md:px-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="font-display text-xl font-semibold">
              Course access has ended
            </h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your access to this course ended 30 days after you were
              certified. Contact your trainer if you need to revisit it.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/partner">
                <ArrowLeft className="h-4 w-4" /> Partner Hub
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inModule) return <Outlet />;

  if (courseQ.isLoading || stateQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }
  if (!courseQ.data) return null;
  const { course, modules, days } = courseQ.data;
  const progress: ModuleProgress[] = stateQ.data?.progress ?? [];
  const isComplete = (id: string) =>
    progress.some((p: ModuleProgress) => p.module_id === id && p.completed_at);
  const dayModules = modules.filter((m: CourseModule) => m.day_id);
  const completedCount = dayModules.filter((m: CourseModule) =>
    isComplete(m.id),
  ).length;
  const totalCount = dayModules.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6 md:px-6 md:py-8">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground hover:text-foreground"
      >
        <Link to="/partner">
          <ArrowLeft className="h-4 w-4" /> Partner Hub
        </Link>
      </Button>

      <PageHero
        eyebrow="Course"
        title={course.title}
        subtitle={course.summary ?? undefined}
        icon={GraduationCap}
        right={
          allDone ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Course complete
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
              <BookOpen className="h-3.5 w-3.5" /> In progress
            </span>
          )
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-medium text-muted-foreground">
            <span className="text-foreground">{completedCount}</span> of{" "}
            {totalCount} modules complete ·{" "}
            <span className="text-foreground">{animatedPct}%</span>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-64">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/60">
              <motion.div
                className="h-full rounded-full bg-linear-to-r from-accent to-[oklch(0.62_0.10_60)]"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            {allDone && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.9, ease: "backOut" }}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success text-white"
              >
                <CheckCircle2 className="h-3 w-3" />
              </motion.span>
            )}
          </div>
        </div>
      </PageHero>

      {(() => {
        const sectionOrder: string[] =
          course.section_order && course.section_order.length
            ? course.section_order.filter((k) => k !== "journey")
            : ["upload", "downloads", "certificate", "modules"];

        const uploadBlock = course.requires_product_upload ? (
          <ProductUploadCard
            key="upload"
            course={course}
            allModulesComplete={allDone}
          />
        ) : null;

        const certBlock = course.issues_certificate ? (
          <CertificateCard
            key="certificate"
            course={course}
            eligible={
              allDone &&
              (!course.requires_product_upload ||
                subQ.data?.status === "approved")
            }
          />
        ) : null;

        // Build day cards with locked progression based on End-of-Day quiz completion.
        type DayInfo = {
          id: string;
          dayNo: number;
          title: string;
          summary: string | null;
          topics: number;
          quizzes: number;
          total: number;
          completed: number;
          endModuleDone: boolean;
          allDone: boolean;
        };
        const dayList: DayInfo[] = days.map((d) => {
          const dayMods = modules.filter((m) => m.day_id === d.id);
          const endMod = dayMods.find((m) => m.quiz_placement === "end_of_day");
          const completed = dayMods.filter((m) => isComplete(m.id)).length;
          return {
            id: d.id,
            dayNo: d.day_no,
            title: d.title,
            summary: d.summary,
            topics: dayMods.filter((m) => m.quiz_placement === "topic").length,
            quizzes: dayMods.filter((m) => m.quiz_placement !== "topic").length,
            total: dayMods.length,
            completed,
            endModuleDone: endMod
              ? isComplete(endMod.id)
              : dayMods.length > 0 && completed === dayMods.length,
            allDone: dayMods.length > 0 && completed === dayMods.length,
          };
        });

        const isUnlocked = (i: number) =>
          i === 0 || dayList[i - 1]?.endModuleDone;

        const DAY_COLORS = [
          {
            text: "text-emerald-600",
            bar: "bg-emerald-400",
            chip: "bg-emerald-100 text-emerald-700",
          },
          {
            text: "text-teal-600",
            bar: "bg-teal-400",
            chip: "bg-teal-100 text-teal-700",
          },
          {
            text: "text-blue-600",
            bar: "bg-blue-400",
            chip: "bg-blue-100 text-blue-700",
          },
          {
            text: "text-purple-600",
            bar: "bg-purple-400",
            chip: "bg-purple-100 text-purple-700",
          },
          {
            text: "text-amber-600",
            bar: "bg-amber-400",
            chip: "bg-amber-100 text-amber-700",
          },
        ];

        const modulesBlock = (
          <Card
            key="modules"
            className="overflow-hidden border-border/70 shadow-(--shadow-card)"
          >
            <CardHeader className="border-b border-border/60 bg-linear-to-r from-surface to-transparent">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-accent" /> 5-Day Learning Plan
              </CardTitle>
              <CardDescription>
                Complete each day in order. Finish the End-of-Day quiz to unlock
                the next day.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-3 pt-4"
              >
                {dayList.map((d, i) => {
                  const unlocked = isUnlocked(i);
                  const done = d.allDone;
                  const inProgress = unlocked && !done && d.completed > 0;
                  const color = DAY_COLORS[i % DAY_COLORS.length];
                  const status = done
                    ? "Completed"
                    : !unlocked
                      ? "Locked"
                      : inProgress
                        ? "In progress"
                        : "Unlocked";
                  const cta = done
                    ? "View Day"
                    : inProgress
                      ? "Continue"
                      : "Start Learning";
                  const pct = d.total
                    ? Math.round((d.completed / d.total) * 100)
                    : 0;
                  return (
                    <motion.div
                      key={d.id}
                      variants={itemVariants}
                      whileHover={unlocked ? { scale: 1.01 } : undefined}
                      className={`flex flex-col gap-4 rounded-2xl border p-4 transition sm:flex-row sm:items-center ${
                        done
                          ? "border-success/40 bg-success/5"
                          : !unlocked
                            ? "border-dashed border-border bg-muted/30 opacity-70"
                            : "border-accent/40 bg-accent/5 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:w-44 sm:shrink-0">
                        <div
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-bold ${
                            unlocked
                              ? color.chip
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {d.dayNo}
                        </div>
                        <div className="min-w-0">
                          <div
                            className={`flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${unlocked ? color.text : "text-muted-foreground"}`}
                          >
                            Day {d.dayNo}
                            {done && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{
                                  duration: 0.3,
                                  delay: 0.4 + i * 0.08,
                                  ease: "backOut",
                                }}
                                className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-success text-white"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" />
                              </motion.span>
                            )}
                            {!unlocked && (
                              <Lock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                            )}
                          </div>
                          <span
                            className={`mt-0.5 inline-block w-fit shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                              done
                                ? "bg-success/15 text-success"
                                : !unlocked
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-accent/15 text-accent"
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-semibold">
                          {d.title}
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {d.summary}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {d.topics} topic{d.topics === 1 ? "" : "s"}
                          </span>
                          <span>·</span>
                          <span>
                            {d.quizzes} quiz{d.quizzes === 1 ? "" : "zes"}
                          </span>
                        </div>
                      </div>

                      <div className="sm:w-40 sm:shrink-0">
                        {unlocked && d.total > 0 ? (
                          <>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                              <motion.div
                                className={`h-full rounded-full ${done ? "bg-success" : "bg-accent"}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                              />
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {d.completed}/{d.total} done
                            </div>
                          </>
                        ) : (
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60" />
                        )}
                      </div>

                      <div className="sm:w-44 sm:shrink-0">
                        {unlocked && done ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="w-full"
                          >
                            <Link
                              to="/learn/$courseId/day/$dayId"
                              params={{ courseId: course.id, dayId: d.id }}
                            >
                              {cta}
                            </Link>
                          </Button>
                        ) : unlocked ? (
                          <Button asChild size="sm" className="w-full">
                            <Link
                              to="/learn/$courseId/day/$dayId"
                              params={{ courseId: course.id, dayId: d.id }}
                            >
                              {cta}
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="w-full"
                          >
                            <Lock className="h-3 w-3" /> Locked — finish Day{" "}
                            {d.dayNo - 1}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                {dayList.length === 0 && (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    No days configured yet.
                  </div>
                )}
              </motion.div>
            </CardContent>
          </Card>
        );

        const downloadsBlock = (
          <DownloadsSection
            key="downloads"
            resources={resourcesQ.data ?? []}
            videos={videosQ.data ?? []}
            loading={resourcesQ.isLoading || videosQ.isLoading}
          />
        );

        const blocks: Record<string, React.ReactNode> = {
          upload: uploadBlock,
          certificate: certBlock,
          modules: modulesBlock,
          downloads: downloadsBlock,
        };

        return (
          <div className="space-y-6">
            {sectionOrder.map((k) => blocks[k] ?? null)}
          </div>
        );
      })()}

      <CelebrationDialog
        open={!!celebrateDay}
        onOpenChange={(o) => {
          if (!o) setCelebrateDay(null);
        }}
        icon={Trophy}
        title="Congratulations!"
        description={
          <>
            You have completed{" "}
            <span className="font-semibold text-success">
              Day {celebrateDay?.dayNo}
            </span>{" "}
            🎉
          </>
        }
        footerClassName="grid grid-cols-1 gap-2 px-6 pb-6 sm:grid-cols-3 sm:gap-3"
        body={
          <>
            {celebrateDay?.scorePct != null && (
              <span className="mb-1 block font-semibold text-success">
                You scored {celebrateDay.scorePct}%
              </span>
            )}
            {celebrateDay?.nextDayId ? (
              <>
                Great job! You&apos;ve made excellent progress. You&apos;re one
                step closer to becoming a Shero Home Food Partner. 💚
              </>
            ) : (
              "You've finished all your days — continue with Cook & Upload to get certified."
            )}
          </>
        }
        footer={
          <>
            {celebrateDay && (
              <Button
                asChild
                variant="outline"
                className="w-full rounded-full"
                onClick={() => setCelebrateDay(null)}
              >
                <Link
                  to="/learn/$courseId/day/$dayId"
                  params={{ courseId: course.id, dayId: celebrateDay.dayId }}
                >
                  <BookOpen className="h-4 w-4" /> Revise Day{" "}
                  {celebrateDay.dayNo}
                </Link>
              </Button>
            )}
            {celebrateDay?.nextDayId ? (
              <Button
                asChild
                className="w-full rounded-full bg-success text-white hover:bg-success/90"
                onClick={() => setCelebrateDay(null)}
              >
                <Link to="/learn/$courseId" params={{ courseId: course.id }}>
                  Back to SFT <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button
                className="w-full rounded-full bg-success text-white hover:bg-success/90"
                onClick={() => {
                  setCelebrateDay(null);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(
                      `shero:cook-unlocked:${courseId}`,
                      "1",
                    );
                  }
                  void navigate({ to: "/partner/cook" });
                }}
              >
                <ChefHat className="h-4 w-4" /> Start Prepare & Cook
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={() => setCelebrateDay(null)}
            >
              <LogOut className="h-4 w-4" /> Exit
            </Button>
          </>
        }
      />
    </div>
  );
}
