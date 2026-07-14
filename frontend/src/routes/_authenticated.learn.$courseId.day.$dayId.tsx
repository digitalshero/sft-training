import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getCourse,
  myCourseState,
  type CourseModule,
  type CourseDay,
  type ModuleProgress,
} from "@/lib/learning/learning.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Flag,
  Lock,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/learn/$courseId/day/$dayId",
)({
  component: DayDetailPage,
});

const TYPE_STYLE: Record<
  string,
  {
    icon: typeof BookOpen;
    iconBg: string;
    iconFg: string;
    badgeBg: string;
    badgeFg: string;
    label: string;
  }
> = {
  topic: {
    icon: BookOpen,
    iconBg: "bg-emerald-100",
    iconFg: "text-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeFg: "text-emerald-700",
    label: "Topic",
  },
  mid_day: {
    icon: Brain,
    iconBg: "bg-pink-100",
    iconFg: "text-pink-600",
    badgeBg: "bg-amber-100",
    badgeFg: "text-amber-700",
    label: "Mid-Day Quiz",
  },
  end_of_day: {
    icon: Flag,
    iconBg: "bg-purple-100",
    iconFg: "text-purple-600",
    badgeBg: "bg-purple-100",
    badgeFg: "text-purple-700",
    label: "End-of-Day Quiz",
  },
};

function DayDetailPage() {
  const { courseId, dayId } = Route.useParams();
  const navigate = useNavigate();
  const fnCourse = getCourse;
  const fnState = myCourseState;

  const courseQ = useQuery({
    queryKey: ["lp-course-learner", courseId],
    queryFn: () => fnCourse({ course_id: courseId }),
  });
  const stateQ = useQuery({
    queryKey: ["lp-course-state", courseId],
    queryFn: () => fnState({ courseId }),
  });

  if (courseQ.isLoading || stateQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }
  if (!courseQ.data) return null;
  const { modules, days } = courseQ.data;
  const progress = stateQ.data?.progress ?? [];
  const isComplete = (id: string) =>
    progress.some((p: ModuleProgress) => p.module_id === id && p.completed_at);

  const day = days.find((d: CourseDay) => d.id === dayId);
  if (!day) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-center text-sm text-muted-foreground">
        Day not found.{" "}
        <Link
          to="/learn/$courseId"
          params={{ courseId }}
          className="text-accent underline"
        >
          Back to course
        </Link>
      </div>
    );
  }

  // Lock guard: ensure all previous days' end-of-day quiz is complete.
  const ordered = [...days].sort((a, b) => a.day_no - b.day_no);
  const idx = ordered.findIndex((d) => d.id === dayId);
  for (let i = 0; i < idx; i++) {
    const prevDay = ordered[i];
    const prevMods = modules.filter(
      (m: CourseModule) => m.day_id === prevDay.id,
    );
    const endMod = prevMods.find(
      (m: CourseModule) => m.quiz_placement === "end_of_day",
    );
    const ok = endMod
      ? isComplete(endMod.id)
      : prevMods.length > 0 &&
        prevMods.every((m: CourseModule) => isComplete(m.id));
    if (!ok) {
      // Redirect back to day cards
      void navigate({ to: "/learn/$courseId", params: { courseId } });
      return null;
    }
  }

  const dayMods = modules
    .filter((m: CourseModule) => m.day_id === dayId)
    .sort((a: CourseModule, b: CourseModule) => a.sort_order - b.sort_order);
  const completedCount = dayMods.filter((m: CourseModule) =>
    isComplete(m.id),
  ).length;
  const allDone = dayMods.length > 0 && completedCount === dayMods.length;
  const nextLocalIdx = dayMods.findIndex(
    (m: CourseModule, i: number) =>
      !isComplete(m.id) && (i === 0 || isComplete(dayMods[i - 1].id)),
  );

  const endMod = dayMods.find(
    (m: CourseModule) => m.quiz_placement === "end_of_day",
  );
  const dayFullyUnlocksNext = endMod ? isComplete(endMod.id) : allDone;
  const prevDay = idx > 0 ? ordered[idx - 1] : null;
  const nextDay = idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6 md:px-6 md:py-8">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground hover:text-foreground"
      >
        <Link to="/learn/$courseId" params={{ courseId }}>
          <ArrowLeft className="h-4 w-4" /> Back to Days Overview
        </Link>
      </Button>

      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="relative max-w-[75%]">
          <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-success">
            Day {day.day_no} of {days.length}
          </span>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {day.title}
          </h1>
          {day.summary && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {day.summary}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {completedCount}
              </span>
              /{dayMods.length} steps complete
            </span>
            {allDone && (
              <>
                <span>|</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success">
                  <CheckCircle2 className="h-3 w-3" /> Day complete
                </span>
              </>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 sm:block">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10">
            <BookOpen className="h-9 w-9 text-primary/50" />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-(--shadow-card)">
        <CardHeader className="border-b border-border/60 bg-linear-to-r from-surface to-transparent">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-accent" /> Steps for Day{" "}
            {day.day_no}
          </CardTitle>
          <CardDescription>
            Complete each step in order. Quizzes unlock the next step.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="relative space-y-3">
            {dayMods.length > 1 && (
              <div className="absolute bottom-5 left-5 top-5 w-0 border-l-2 border-dashed border-border" />
            )}
            {dayMods.map((m: CourseModule, i: number) => {
              const done = isComplete(m.id);
              const locked = i > 0 && !isComplete(dayMods[i - 1].id);
              const isNext = i === nextLocalIdx;
              const type = TYPE_STYLE[m.quiz_placement] ?? TYPE_STYLE.topic;
              const Icon = type.icon;
              return (
                <div key={m.id} className="relative flex gap-4">
                  <div
                    className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 bg-card text-sm font-bold ${
                      done
                        ? "border-success bg-success text-white"
                        : isNext
                          ? "border-success text-success"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <div
                    className={`flex-1 rounded-2xl border p-4 transition ${
                      isNext
                        ? "border-success/40 bg-success/5 shadow-sm"
                        : "border-border/60 bg-muted/20"
                    } ${locked ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${type.iconBg} ${type.iconFg}`}
                      >
                        {locked ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{m.title}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${type.badgeBg} ${type.badgeFg}`}
                          >
                            {type.label}
                          </span>
                          {m.est_minutes && (
                            <span className="text-xs text-muted-foreground">
                              · {m.est_minutes} min
                            </span>
                          )}
                        </div>
                        {m.summary && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {m.summary}
                          </p>
                        )}
                      </div>
                      <Button
                        asChild
                        size="sm"
                        disabled={locked}
                        variant={done ? "outline" : "default"}
                        className="shrink-0"
                      >
                        <Link
                          to="/learn/$courseId/$moduleId"
                          params={{ courseId, moduleId: m.id }}
                        >
                          {done
                            ? "Review"
                            : locked
                              ? "Locked"
                              : isNext
                                ? "Start"
                                : "Open"}
                          {!done && !locked && (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {dayMods.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No content for this day yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        {prevDay ? (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/learn/$courseId/day/$dayId"
              params={{ courseId, dayId: prevDay.id }}
            >
              <ArrowLeft className="h-4 w-4" /> Previous Day
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ArrowLeft className="h-4 w-4" /> Previous Day
          </Button>
        )}
        {nextDay && dayFullyUnlocksNext ? (
          <Button asChild size="sm">
            <Link
              to="/learn/$courseId/day/$dayId"
              params={{ courseId, dayId: nextDay.id }}
            >
              Next Day <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next Day <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
