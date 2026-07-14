import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getCourse,
  getModuleSlides,
  myCourseState,
  markModuleComplete,
  type CourseModule,
  type ModuleProgress,
} from "@/lib/learning/learning.functions";
import { getSignedUrl } from "@/lib/api/storage";
import type { ParsedSlide } from "@/lib/sft-training/pptx-parser";
import { FullScreenSlidePlayer } from "@/components/learn/FullScreenSlidePlayer";
import { InlineQuiz } from "@/components/learn/InlineQuiz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  PlayCircle,
} from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/learn/$courseId/$moduleId",
)({
  component: ModulePlayer,
});

// Slides are parsed server-side (and cached there too) — this just avoids
// re-hitting the network for a deck already fetched earlier in this session
// (e.g. Previous/Next between days).
const parsedDeckCache = new Map<string, Promise<ParsedSlide[]>>();

// Navigating between modules only changes the `:moduleId` route param —
// React doesn't remount the component for that, so any local state below
// (quizAutoOpen, InlineQuiz's internal "has the quiz auto-opened yet" ref,
// SlidesModule's viewMode/maxSlideReached, etc.) would otherwise leak from
// one module into the next. Keying on moduleId forces a clean remount of
// the whole subtree every time the module actually changes.
function ModulePlayer() {
  const { moduleId } = Route.useParams();
  return <ModulePlayerInner key={moduleId} />;
}

function ModulePlayerInner() {
  const { courseId, moduleId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fnCourse = getCourse;
  const fnState = myCourseState;
  const fnComplete = markModuleComplete;

  const courseQ = useQuery({
    queryKey: ["lp-course-learner", courseId],
    queryFn: () => fnCourse({ course_id: courseId }),
  });
  const stateQ = useQuery({
    queryKey: ["lp-course-state", courseId],
    queryFn: () => fnState({ courseId }),
  });

  const completeMut = useMutation({
    mutationFn: fnComplete,
    onSuccess: () => {
      toast.success("Module marked complete");
      qc.invalidateQueries({ queryKey: ["lp-course-state", courseId] });
      qc.invalidateQueries({ queryKey: ["partner-dash"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Set once a slides module's "Finish Module" is clicked, so its own
  // (rare) attached quiz opens immediately without a manual "Take Quiz"
  // click. Quiz-only checkpoint modules (no slide content to watch first)
  // don't need this — they always auto-open on arrival, see `autoOpen` below.
  const [quizAutoOpen, setQuizAutoOpen] = useState(false);
  const lastScoreRef = useRef<number | null>(null);

  const course = courseQ.data?.course ?? null;
  const modules = courseQ.data?.modules ?? [];
  const module = modules.find((m: CourseModule) => m.id === moduleId) ?? null;
  const dayMods = module?.day_id
    ? modules
        .filter((m: CourseModule) => m.day_id === module.day_id)
        .sort((a: CourseModule, b: CourseModule) => a.sort_order - b.sort_order)
    : [];
  const dayIdx = module
    ? dayMods.findIndex((m: CourseModule) => m.id === moduleId)
    : -1;
  const prevMod = dayIdx > 0 ? dayMods[dayIdx - 1] : null;
  const nextMod =
    dayIdx >= 0 && dayIdx < dayMods.length - 1 ? dayMods[dayIdx + 1] : null;
  const done = (stateQ.data?.progress ?? []).some(
    (p: ModuleProgress) => p.module_id === moduleId && p.completed_at,
  );
  if (courseQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }
  if (!course) return null;
  if (!module) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-center text-sm text-muted-foreground">
        Module not found.{" "}
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

  const hasQuiz = module.quiz_enabled && module.quiz_questions.length > 0;
  // Quiz-only checkpoint modules (reading/mixed/video with no slides of
  // their own) always jump straight into the quiz on arrival — there's no
  // content to watch first, so the manual "Take Quiz" trigger card would
  // just be an extra, pointless click every time the page is visited. This
  // applies whether the module is being seen for the first time or revisited
  // (Previous/Next/Revise) after already being completed, so the same quiz
  // UI is always what's shown — never a separate "already passed" summary.
  const quizOpensOnArrival = hasQuiz && module.type !== "slides";

  function goToNextModule(target: CourseModule | null) {
    if (!target) {
      void navigate({ to: "/learn/$courseId", params: { courseId } });
      return;
    }
    void navigate({
      to: "/learn/$courseId/$moduleId",
      params: { courseId, moduleId: target.id },
    });
  }

  function handleReachEnd() {
    if (hasQuiz) {
      setQuizAutoOpen(true);
    } else {
      completeMut.mutate(
        { moduleId },
        { onSuccess: () => goToNextModule(nextMod) },
      );
    }
  }

  function onPassed(pct: number) {
    lastScoreRef.current = pct;
    qc.invalidateQueries({ queryKey: ["lp-course-state", courseId] });
    qc.invalidateQueries({ queryKey: ["partner-dash"] });
  }

  function onContinuePassed() {
    // End-of-day passes hand off to the day-overview page's celebration
    // dialog via a stashed score. Everything else advances straight to the
    // next module — no extra manual "Next" click needed.
    if (module.quiz_placement === "end_of_day" && module.day_id) {
      sessionStorage.setItem(
        `day-score:${courseId}:${module.day_id}`,
        String(lastScoreRef.current ?? 0),
      );
      void navigate({ to: "/learn/$courseId", params: { courseId } });
    } else {
      goToNextModule(nextMod);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/learn/$courseId" params={{ courseId }}>
            <ArrowLeft className="h-4 w-4" /> Course overview
          </Link>
        </Button>
        <div className="text-xs text-muted-foreground">
          Step {dayIdx + 1} of {dayMods.length}
        </div>
      </div>

      <header>
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {course.title}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {module.title}
        </h1>
        {module.summary && (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {module.summary}
          </p>
        )}
      </header>

      {module.type === "slides" && (
        <SlidesModule module={module} done={done} onFinish={handleReachEnd} />
      )}
      {module.type === "video" && <VideoModule url={module.video_url} />}
      {module.type === "reading" && <ReadingModule md={module.reading_md} />}
      {module.type === "mixed" && <MixedModule module={module} />}

      {hasQuiz && (
        <InlineQuiz
          moduleId={moduleId}
          questions={module.quiz_questions}
          passPct={module.quiz_pass_pct}
          quizPlacement={module.quiz_placement}
          autoOpen={quizOpensOnArrival || quizAutoOpen}
          revisedContent={module.reading_md ?? undefined}
          onPassed={onPassed}
          onContinuePassed={onContinuePassed}
        />
      )}

      {/* Slides modules drive their own completion/navigation via the
          full-screen player's "Finish Module" and the quiz's "Continue" —
          this manual bar would just be a redundant, confusing second path. */}
      {module.type !== "slides" && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              {prevMod && (
                <Button asChild variant="outline" size="sm">
                  <Link
                    to="/learn/$courseId/$moduleId"
                    params={{ courseId, moduleId: prevMod.id }}
                  >
                    <ArrowLeft className="h-4 w-4" /> Previous
                  </Link>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {done ? (
                <span className="inline-flex items-center gap-1 text-sm text-accent">
                  <CheckCircle2 className="h-4 w-4" /> Completed
                </span>
              ) : hasQuiz ? (
                <span className="text-xs text-muted-foreground">
                  Pass the quiz above to complete this module
                </span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => completeMut.mutate({ moduleId })}
                  disabled={completeMut.isPending}
                >
                  Mark complete
                </Button>
              )}
              {nextMod && (
                <Button
                  asChild
                  size="sm"
                  variant={done ? "default" : "outline"}
                  disabled={!done}
                >
                  <Link
                    to="/learn/$courseId/$moduleId"
                    params={{ courseId, moduleId: nextMod.id }}
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SlidesModule({
  module,
  done,
  onFinish,
}: {
  module: CourseModule;
  done: boolean;
  onFinish: () => void;
}) {
  // Jump straight into the slide viewer — the overview/resume card only
  // matters again if the learner exits mid-deck (handled by onExit below).
  const [viewMode, setViewMode] = useState<"overview" | "fullscreen">(
    "fullscreen",
  );
  const [maxSlideReached, setMaxSlideReached] = useState(0);
  const [slides, setSlides] = useState<ParsedSlide[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deckInfo, setDeckInfo] = useState<{
    name: string;
    autoplay_advance: boolean;
  } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    setPdfUrl(null);
    if (!module.pdf_path) return;
    void getSignedUrl("sft-decks", module.pdf_path).then(setPdfUrl);
  }, [module.pdf_path]);

  const load = useCallback(async () => {
    // Only show content that was explicitly uploaded for this day module.
    // The admin pitch-player deck (SftDeckSetup via deckId) is intentionally
    // excluded here — it is only accessible via /sft-training/play/:courseId.
    if (!module.file_path) {
      setErr("No slides uploaded for this day.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      setDeckInfo({
        name: module.title,
        autoplay_advance: module.autoplay_advance ?? true,
      });
      const filePath = module.file_path;
      let parsedPromise = parsedDeckCache.get(filePath);
      if (!parsedPromise) {
        parsedPromise = getModuleSlides({ module_id: module.id }).then((r) => r.slides);
        parsedDeckCache.set(filePath, parsedPromise);
      }
      const parsed = await parsedPromise.catch((e) => {
        parsedDeckCache.delete(filePath); // don't cache a failed attempt — let Retry actually retry
        throw e;
      });
      setSlides(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load slides");
    } finally {
      setLoading(false);
    }
  }, [
    module.file_path,
    module.title,
    module.autoplay_advance,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Apply module-level per-slide overrides (custom speaker notes / titles).
  const effectiveSlides = useMemo<ParsedSlide[] | null>(() => {
    if (!slides) return null;
    const overrides = module.slide_overrides ?? {};
    return slides.map((s) => {
      const ov = overrides[String(s.index)];
      if (!ov) return s;
      return {
        ...s,
        title: ov.title ?? s.title,
        notes:
          ov.speaker_notes && ov.speaker_notes.length > 0
            ? ov.speaker_notes
            : s.notes,
      };
    });
  }, [slides, module.slide_overrides]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading deck…
        </CardContent>
      </Card>
    );
  }
  if (err) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-6 text-sm text-destructive">
          {err}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={load}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!effectiveSlides || !deckInfo) return null;
  if (module.pdf_path && !pdfUrl) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading deck…
        </CardContent>
      </Card>
    );
  }

  const total = effectiveSlides.length;

  if (viewMode === "fullscreen") {
    return (
      <FullScreenSlidePlayer
        moduleId={module.id}
        slides={effectiveSlides}
        pdfUrl={pdfUrl}
        initialSlideIndex={Math.min(maxSlideReached, Math.max(0, total - 1))}
        onExit={() => setViewMode("overview")}
        onSlideChange={(i) => setMaxSlideReached((m) => Math.max(m, i + 1))}
        onFinish={() => {
          setViewMode("overview");
          onFinish();
        }}
      />
    );
  }

  const ctaLabel = done
    ? "Review Module"
    : maxSlideReached > 0
      ? "Continue Learning"
      : "Start Module";

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success">
          <PlayCircle className="h-7 w-7" />
        </div>
        <div>
          <div className="text-sm font-medium">
            {Math.min(maxSlideReached, total)} / {total} Slides Completed
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {deckInfo.name}
          </p>
        </div>
        <Button onClick={() => setViewMode("fullscreen")}>
          <PlayCircle className="h-4 w-4" /> {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function VideoModule({ url }: { url: string | null }) {
  if (!url) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No video configured.
        </CardContent>
      </Card>
    );
  }
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/,
  );
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (yt) {
    return (
      <Card>
        <CardContent className="p-0 aspect-video">
          <iframe
            className="h-full w-full rounded-md"
            src={`https://www.youtube.com/embed/${yt[1]}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </CardContent>
      </Card>
    );
  }
  if (vimeo) {
    return (
      <Card>
        <CardContent className="p-0 aspect-video">
          <iframe
            className="h-full w-full rounded-md"
            src={`https://player.vimeo.com/video/${vimeo[1]}`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <video className="w-full rounded-md" src={url} controls />
      </CardContent>
    </Card>
  );
}

function ReadingModule({ md }: { md: string | null }) {
  if (!md) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No content provided.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reading</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90 dark:prose-invert">
          {md}
        </div>
      </CardContent>
    </Card>
  );
}

function MixedModule({ module }: { module: CourseModule }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!module.file_path) return;
    void getSignedUrl("sft-decks", module.file_path).then(setPdfUrl);
  }, [module.file_path]);

  return (
    <div className="space-y-4">
      {module.file_path && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full rounded-b-md border-0"
                style={{ height: "calc(100vh - 220px)", minHeight: "600px" }}
                title="Module document"
              />
            ) : (
              <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {module.reading_md && <ReadingModule md={module.reading_md} />}
      {!module.file_path && !module.reading_md && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No content provided.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
