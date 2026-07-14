import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  listPrograms,
  listCoursesForProgram,
  myEnrolments,
  enrol,
  type Course,
} from "@/lib/learning/learning.functions";
import {
  listPartnerResources,
  listPartnerVideos,
} from "@/lib/partner/partner.functions";
import { DownloadsSection } from "@/components/learn/DownloadsSection";
import api from "@/lib/api/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  GraduationCap,
  ArrowRight,
  Clock,
  Award,
  BookOpen,
} from "lucide-react";
import { PageHero } from "@/components/partner/page-hero";

export const Route = createFileRoute("/_authenticated/learn/")({
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
  }),
  component: MyLearning,
});

function MyLearning() {
  const qc = useQueryClient();
  const { invite: inviteToken } = Route.useSearch();
  const fnPrograms = listPrograms;
  const fnCourses = listCoursesForProgram;
  const fnMine = myEnrolments;

  const progQ = useQuery({
    queryKey: ["lp-programs"],
    queryFn: () => fnPrograms(),
  });
  const program = progQ.data?.[0];
  const coursesQ = useQuery({
    queryKey: ["lp-courses", program?.id],
    enabled: !!program,
    queryFn: () => fnCourses({ program_id: program!.id }),
  });
  const mineQ = useQuery({ queryKey: ["lp-mine"], queryFn: () => fnMine() });

  // When arriving via invite link, auto-enrol in the invited course
  const inviteEnrolMut = useMutation({
    mutationFn: (token: string) =>
      api.post("/learning/enrol-by-invite", { token }).then((r) => r.data) as Promise<{ course_id: string; course_title: string; published: boolean }>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lp-mine"] });
      qc.invalidateQueries({ queryKey: ["lp-courses"] });
    },
    onError: () => {},
  });

  useEffect(() => {
    if (inviteToken && !inviteEnrolMut.isPending && !inviteEnrolMut.isSuccess && !inviteEnrolMut.isError) {
      inviteEnrolMut.mutate(inviteToken);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

  const enrolMut = useMutation({
    mutationFn: enrol,
    onSuccess: () => {
      toast.success("Enrolled");
      qc.invalidateQueries({ queryKey: ["lp-mine"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enrolledIds = new Set(
    (mineQ.data ?? []).map((e: { course_id: string }) => e.course_id),
  );

  // The course from the invite link (may be draft, show it anyway)
  const invitedCourseId = inviteEnrolMut.data?.course_id;
  const invitedCourseTitle = inviteEnrolMut.data?.course_title;

  if (progQ.isLoading || coursesQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 md:px-6 md:py-8">
      <PageHero
        eyebrow="My Learning"
        title={program?.title ?? "Learning"}
        subtitle={program?.summary ?? undefined}
        icon={BookOpen}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Courses
          </h2>
          <span className="text-xs text-muted-foreground">
            {(coursesQ.data ?? []).filter((c) => c.published).length} available
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Show invited-course card even if draft, when arriving via invite link */}
          {invitedCourseId &&
            !(coursesQ.data ?? []).some((c) => c.id === invitedCourseId) && (
              <Card className="group overflow-hidden border-accent/50">
                <CardHeader className="bg-linear-to-br from-surface to-transparent">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{invitedCourseTitle}</CardTitle>
                      <CardDescription>Your invited course</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end">
                    <Button asChild size="sm">
                      <Link to="/learn/$courseId" params={{ courseId: invitedCourseId }}>
                        Continue <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          {(coursesQ.data ?? [])
            .filter((c) => c.published)
            .map((c) => {
              const enrolled = enrolledIds.has(c.id);
              return (
                <CourseListCard
                  key={c.id}
                  course={c}
                  enrolled={enrolled}
                  onEnrol={() => enrolMut.mutate({ courseId: c.id })}
                  enrolPending={enrolMut.isPending}
                />
              );
            })}
        </div>
      </section>
    </div>
  );
}

function CourseListCard({
  course: c,
  enrolled,
  onEnrol,
  enrolPending,
}: {
  course: Course;
  enrolled: boolean;
  onEnrol: () => void;
  enrolPending: boolean;
}) {
  const resourcesQ = useQuery({
    queryKey: ["lp-partner-resources", c.id],
    enabled: enrolled,
    queryFn: () => listPartnerResources({ course_id: c.id }),
  });
  const videosQ = useQuery({
    queryKey: ["lp-partner-videos", c.id],
    enabled: enrolled,
    queryFn: () => listPartnerVideos({ course_id: c.id }),
  });

  return (
    <Card
      key={c.id}
      className="group overflow-hidden border-border/70 transition hover:border-accent/50 hover:shadow-(--shadow-card)"
    >
      <CardHeader className="bg-linear-to-br from-surface to-transparent">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{c.title}</CardTitle>
            <CardDescription className="line-clamp-2">
              {c.summary}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {c.duration_label && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> {c.duration_label}
            </Badge>
          )}
          {c.issues_certificate && (
            <Badge variant="outline" className="gap-1">
              <Award className="h-3 w-3" /> Certificate
            </Badge>
          )}
          <Badge variant="outline">Pass ≥ {c.pass_pct}%</Badge>
        </div>
        <div className="flex justify-end">
          {enrolled ? (
            <Button asChild size="sm">
              <Link to="/learn/$courseId" params={{ courseId: c.id }}>
                Continue <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" onClick={onEnrol} disabled={enrolPending}>
              {enrolPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              Enrol
            </Button>
          )}
        </div>
      </CardContent>
      {enrolled && (
        <CardContent className="pt-0">
          <DownloadsSection
            resources={resourcesQ.data ?? []}
            videos={videosQ.data ?? []}
            loading={resourcesQ.isLoading || videosQ.isLoading}
          />
        </CardContent>
      )}
    </Card>
  );
}
