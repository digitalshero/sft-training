// Pitch Player — full-page partner-view simulation for an SFT course.
// PDF slide canvas + transport (Start Pitch / prev / next / Restart / Full
// Screen / Voice off), per-slide global voice/speed/duration overrides,
// read-only speaker-notes panel, and a quick-jump grid for every slide.
//
// Voice/speed/duration overrides are stored on lp_modules.slide_overrides
// (one row per course's slides module), so they are global per slide for
// every S&M user playing this course.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PdfSlideCanvas } from "@/components/sft-training/PdfSlideCanvas";
import {
  getCourseTeachData,
  upsertSlideOverride,
  type SlideOverride,
} from "@/lib/learning/learning.functions";
import type { ParsedSlide } from "@/lib/sft-training/pptx-parser";
import { STATIC_VOICE_ID, STATIC_SPEED } from "@/lib/tts-voice";

export const Route = createFileRoute(
  "/_authenticated/sft-training/play/$courseId",
)({
  component: PitchPlayerPage,
});

const DEFAULT_DURATION = 60;

// TEMP: hardcoded video override to bypass ElevenLabs TTS cost for specific
// courses that already have a fully pre-rendered video (slides + narration
// baked in via PowerPoint's "Create a Video" export). Add more course IDs
// here as needed.
const VIDEO_OVERRIDE: Record<string, string> = {
  "2ac06a86-ce05-42e8-bc36-a0b676873d20":
    "https://sft.sherosft.com/videos/scpp-voice.mp4",
};

function PitchPlayerPage() {
  const { courseId } = Route.useParams();
  const isVideoOverride = Boolean(VIDEO_OVERRIDE[courseId]);

  const fn = getCourseTeachData;
  const q = useQuery({
    queryKey: ["pitch-teach", courseId],
    queryFn: () => fn({ course_id: courseId }),
    staleTime: 0,
    refetchOnMount: "always",
    enabled: !isVideoOverride,
  });

  if (isVideoOverride) {
    return <VideoPitchPlayer videoUrl={VIDEO_OVERRIDE[courseId]} />;
  }

  // Slide text (titles/bullets/speaker notes) is parsed server-side, cached,
  // and returned right alongside the rest of teach-data — no separate
  // client-side download + parse of the raw .pptx needed.
  const slides = q.data?.slides ?? null;

  if (q.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          {(q.error as Error).message}
        </CardContent>
      </Card>
    );
  }

  const data = q.data!;
  if (!data.module || !data.deck) {
    return (
      <EmptyState
        courseTitle={data.course.title}
        message="This course has no slides module or no deck attached yet."
      />
    );
  }
  if (!data.pdfUrl) {
    return (
      <EmptyState
        courseTitle={data.course.title}
        message="This deck has no PDF visual attached. Upload a PDF on the program page before playing the pitch."
      />
    );
  }
  if (!slides) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        Loading deck…
      </div>
    );
  }

  return (
    <PitchPlayer
      courseTitle={data.course.title}
      deckName={data.deck.name}
      moduleId={data.module.id}
      pdfUrl={data.pdfUrl}
      slides={slides}
      defaultDuration={data.module.default_slide_seconds ?? DEFAULT_DURATION}
      overrides={
        (data.module.slide_overrides ?? {}) as Record<string, SlideOverride>
      }
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Video override player — plays a single pre-rendered video (slides + audio
// already baked in) instead of the PDF-canvas + live-TTS system.
// ────────────────────────────────────────────────────────────────────────────
function VideoPitchPlayer({ videoUrl }: { videoUrl: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild size="sm" variant="ghost">
          <Link to="/sft-training/program">
            <ArrowLeft className="h-4 w-4" /> Program
          </Link>
        </Button>
      </div>
      <Card className="overflow-hidden">
        <video
          src={videoUrl}
          controls
          className="w-full aspect-video bg-black"
        />
      </Card>
    </div>
  );
}

function EmptyState({
  courseTitle,
  message,
}: {
  courseTitle: string;
  message: string;
}) {
  return (
    <div className="space-y-4">
      <BackBar title={courseTitle} />
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {message}
        </CardContent>
      </Card>
    </div>
  );
}

function BackBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button asChild size="sm" variant="ghost">
        <Link to="/sft-training/program">
          <ArrowLeft className="h-4 w-4" /> Program
        </Link>
      </Button>
      <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {title}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Pitch Player (main interactive view)
// ────────────────────────────────────────────────────────────────────────────
interface PlayerProps {
  courseTitle: string;
  deckName: string;
  moduleId: string;
  pdfUrl: string;
  slides: ParsedSlide[];
  defaultDuration: number;
  overrides: Record<string, SlideOverride>;
}

type Status = "idle" | "loading" | "playing" | "paused" | "ended" | "waiting";

function PitchPlayer(props: PlayerProps) {
  const {
    courseTitle,
    deckName,
    moduleId,
    pdfUrl,
    slides,
    defaultDuration,
    overrides,
  } = props;
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const total = slides.length;
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);

  const slideIdx = slides[current]?.index ?? current + 1;
  const slideKey = String(slideIdx);
  const ov = overrides[slideKey] ?? {};
  const effDuration = ov.duration_seconds ?? defaultDuration;

  const [draftDuration, setDraftDuration] = useState(String(effDuration));
  useEffect(() => {
    setDraftDuration(String(effDuration));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideKey]);

  const hasOverride = Boolean(overrides[slideKey]);
  const isDirty = Number(draftDuration) !== effDuration;

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const playheadRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  function clearAdvanceTimer() {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }
  const stopAudio = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearAdvanceTimer();
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* noop */
      }
    });
    sourcesRef.current = [];
    playheadRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
      ctxRef.current?.close().catch(() => {});
    };
  }, [stopAudio]);

  function ensureCtx(): AudioContext {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = mutedRef.current ? 0 : 1;
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
    }
    return ctxRef.current;
  }
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = muted ? 0 : 1;
  }, [muted]);

  async function playFrom(idx: number) {
    stopAudio();
    setCurrent(idx);
    const slide = slides[idx];
    if (!slide) return;
    const key = String(slide.index);
    const o = overrides[key] ?? {};
    const isEditingThisSlide = key === slideKey;
    const draftDu = Number(draftDuration);
    const v = STATIC_VOICE_ID;
    const sp = STATIC_SPEED;
    const dur =
      isEditingThisSlide && Number.isFinite(draftDu) && draftDu > 0
        ? draftDu
        : (o.duration_seconds ?? defaultDuration);
    const text = (o.speaker_notes ?? slide.notes ?? "").trim();

    setStatus("loading");
    const ctx = ensureCtx();
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});

    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++seqRef.current;

    function scheduleAdvance(audioMs: number) {
      const wait = Math.max(audioMs, dur * 1000) + 300;
      advanceTimerRef.current = setTimeout(() => {
        if (seq !== seqRef.current) return;
        if (idx + 1 < slides.length) playFrom(idx + 1);
        else setStatus("ended");
      }, wait);
    }

    if (!text) {
      setStatus("waiting");
      scheduleAdvance(0);
      return;
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: v }),
        signal: controller.signal,
      });
      if (seq !== seqRef.current) return;
      if (!res.ok) {
        toast.error(`Slide ${slide.index}: voiceover failed (${res.status}).`);
        setStatus("waiting");
        scheduleAdvance(0);
        return;
      }
      const arrayBuf = await res.arrayBuffer();
      if (seq !== seqRef.current) return;
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      if (seq !== seqRef.current) return;
      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.playbackRate.value = sp;
      source.connect(gainRef.current ?? ctx.destination);
      source.start(0);
      sourcesRef.current.push(source);
      setStatus("playing");
      scheduleAdvance((audioBuf.duration / sp) * 1000);
    } catch (err) {
      if (controller.signal.aborted) return;
      toast.error(
        `Slide ${slide.index}: audio error — advancing without voice.`,
      );
      setStatus("waiting");
      scheduleAdvance(0);
    }
  }

  function handleStart() {
    if (status === "playing" || status === "loading") return;
    playFrom(current);
  }
  function handlePause() {
    stopAudio();
    setStatus("paused");
  }
  function handlePrev() {
    if (current === 0) return;
    stopAudio();
    setCurrent(current - 1);
    setStatus("idle");
  }
  function handleNext() {
    if (current + 1 >= total) return;
    stopAudio();
    setCurrent(current + 1);
    setStatus("idle");
  }
  function handleRestart() {
    stopAudio();
    setCurrent(0);
    setStatus("idle");
  }
  function jumpTo(idx: number) {
    stopAudio();
    setCurrent(idx);
    setStatus("idle");
  }

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  async function toggleFs() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement)
      await document.exitFullscreen().catch(() => {});
    else await el.requestFullscreen().catch(() => {});
  }

  const saveMut = useMutation({
    mutationFn: upsertSlideOverride,
    onSuccess: () => {
      toast.success(`Saved overrides for slide ${slideIdx}`);
      qc.invalidateQueries({ queryKey: ["pitch-teach" /* courseId */] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function saveSlide() {
    const du = Number(draftDuration);
    if (!Number.isFinite(du) || du < 1 || du > 3600) {
      toast.error("Duration must be between 1 and 3600 seconds");
      return;
    }
    const updated = { ...(overrides ?? {}) } as Record<string, SlideOverride>;
    updated[String(slideIdx)] = {
      ...updated[String(slideIdx)],
      duration_seconds: du,
    };
    saveMut.mutate({ id: moduleId, slide_overrides: updated });
  }
  function resetSlide() {
    const updated = { ...(overrides ?? {}) } as Record<string, SlideOverride>;
    delete updated[String(slideIdx)];
    saveMut.mutate({ id: moduleId, slide_overrides: updated });
  }

  const speakerNotes = ov.speaker_notes ?? slides[current]?.notes ?? "";
  const slideTitle = ov.title ?? slides[current]?.title ?? "";

  const transport = (
    <>
      {status === "playing" || status === "loading" ? (
        <Button
          size="sm"
          onClick={handlePause}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Pause className="h-4 w-4" /> Pause Pitch
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleStart}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Play className="h-4 w-4" /> Start Pitch
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={handlePrev}
        disabled={current === 0}
      >
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleNext}
        disabled={current + 1 >= total}
      >
        <SkipForward className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="outline" onClick={handleRestart}>
        <RotateCcw className="h-4 w-4" /> Restart
      </Button>
      <Button size="sm" variant="outline" onClick={toggleFs}>
        {isFs ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
        {isFs ? "Exit" : "Full Screen"}
      </Button>
      <Button size="sm" variant="outline" onClick={() => setMuted((m) => !m)}>
        {muted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        {muted ? "Voice off" : "Voice on"}
      </Button>
      <div className="ml-auto text-xs text-muted-foreground">
        Slide {current + 1} of {total}
      </div>
    </>
  );

  return (
    <div
      ref={containerRef}
      className={
        isFs
          ? "fixed inset-0 z-50 flex flex-col bg-black"
          : "space-y-5 bg-background"
      }
    >
      {isFs ? (
        <>
          <div className="relative flex-1 min-h-0 bg-black">
            <div className="absolute inset-0">
              <PdfSlideCanvas
                url={pdfUrl}
                pageNumber={slideIdx}
                cacheKey={moduleId}
              />
            </div>
            {status === "loading" && (
              <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-wider text-white/70 animate-pulse">
                Loading voiceover…
              </div>
            )}
            {status === "playing" && (
              <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary-foreground/80">
                <span className="inline-block h-2 w-2 rounded-full bg-primary-foreground animate-pulse" />
                Narrating
              </div>
            )}
            {status === "ended" && (
              <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Presentation completed
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-background/95 border-t border-border">
            {transport}
          </div>
        </>
      ) : (
        <>
          <BackBar title={`${courseTitle} · ${deckName}`} />

          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-black/5">
              <PdfSlideCanvas
                url={pdfUrl}
                pageNumber={slideIdx}
                cacheKey={moduleId}
              />
              {status === "loading" && (
                <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-wider text-muted-foreground animate-pulse">
                  Loading voiceover…
                </div>
              )}
              {status === "playing" && (
                <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-accent">
                  <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
                  Narrating
                </div>
              )}
              {status === "waiting" && (
                <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Holding for slide duration…
                </div>
              )}
              {status === "ended" && (
                <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-success">
                  <CheckCircle2 className="h-3 w-3" /> Presentation completed
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center gap-2 py-3">
              {transport}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">Slide duration</CardTitle>
                <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                  How long slide #{slideIdx} holds before advancing. Shared with
                  everyone who plays this course. Narration always uses the same
                  voice at normal speed.
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                Global per slide
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-[140px_auto]">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Duration ({effDuration}s)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="3600"
                    value={draftDuration}
                    onChange={(e) => setDraftDuration(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    size="sm"
                    onClick={saveSlide}
                    disabled={!isDirty || saveMut.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {saveMut.isPending && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    Save slide
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={resetSlide}
                    disabled={!hasOverride || saveMut.isPending}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Speaker notes (read-only)
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                CEO controlled
              </Badge>
            </CardHeader>
            <CardContent>
              {slideTitle && (
                <div className="text-sm font-medium mb-2">{slideTitle}</div>
              )}
              {speakerNotes ? (
                <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                  {speakerNotes}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No speaker notes for this slide.
                </p>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Duration {effDuration}s
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick jump</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {slides.map((s, i) => {
                  const k = String(s.index);
                  const isCurrent = i === current;
                  const isCustom = Boolean(overrides[k]);
                  return (
                    <button
                      key={k}
                      onClick={() => jumpTo(i)}
                      className={
                        "h-8 min-w-8 px-2 rounded text-xs font-medium border transition-colors " +
                        (isCurrent
                          ? "bg-primary text-primary-foreground border-primary"
                          : isCustom
                            ? "bg-accent-soft text-primary border-primary/30 hover:bg-accent-soft/80"
                            : "bg-background hover:bg-muted border-border")
                      }
                      title={
                        isCustom ? "Has custom voice / speed / duration" : ""
                      }
                    >
                      {s.index}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Highlighted = this slide has a custom voice, speed, or duration
                saved.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
