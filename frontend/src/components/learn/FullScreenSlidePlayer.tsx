// Full-screen, hidden-chrome slide learning experience for partner training
// modules. Controls are minimal by default (Exit, gear, transport strip);
// richer settings (speaker notes, slide jump, personal notes) live behind
// the floating "Learning Controls" gear button in a slide-in panel.
// Narrates via the ElevenLabs TTS proxy (/api/tts) using one fixed voice at
// normal speed for every partner (see lib/tts-voice.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Mic,
  Minus,
  NotebookPen,
  Pause,
  Play,
  Plus,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { PdfSlideCanvas } from "@/components/sft-training/PdfSlideCanvas";
import type { ParsedSlide } from "@/lib/sft-training/pptx-parser";
import { getModuleNote, saveModuleNote } from "@/lib/learning/learning.functions";
import { STATIC_VOICE_ID, STATIC_SPEED } from "@/lib/tts-voice";

// ElevenLabs renders speech at a moderate loudness relative to typical media
// — boost it via a gain node so it's clearly audible at normal volume.
const GAIN_BOOST = 1.6;

// How long to sit on a slide with no speaker notes (or while muted, when no
// audio-ended event will ever fire) before auto-advancing — ~150 wpm pace.
function estimateDwellMs(text: string) {
  if (!text) return 4000;
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3000, (words / 2.5) * 1000);
}

// A long slide's speaker notes are split and requested one piece at a time
// (rather than one big request) so narration can start as soon as the FIRST
// piece is ready instead of waiting for the whole slide to finish generating
// — TTS generation time scales with output length and doesn't parallelize
// well across concurrent requests from the same account.
const MAX_CHARS_PER_TTS_CHUNK = 2000;
function chunkTextForTts(text: string, maxChars = MAX_CHARS_PER_TTS_CHUNK): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

interface Props {
  moduleId: string;
  slides: ParsedSlide[];
  pdfUrl: string | null;
  initialSlideIndex?: number;
  onExit: () => void;
  onSlideChange?: (idx: number) => void;
  onFinish: () => void;
}

export function FullScreenSlidePlayer({
  moduleId,
  slides,
  pdfUrl,
  initialSlideIndex = 0,
  onExit,
  onSlideChange,
  onFinish,
}: Props) {
  const total = slides.length;
  const [current, setCurrent] = useState(
    Math.min(initialSlideIndex, Math.max(0, total - 1)),
  );
  const [zoom, setZoom] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  // Narration never starts on its own — the learner must press Play. Manual
  // slide navigation pauses it again until Play is pressed for the new slide.
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const slide = slides[current];
  const isLast = current === total - 1;

  // ── Narration via OpenAI TTS (/api/tts), played through Web Audio so we can
  // boost gain and reliably detect/recover from autoplay blocking. A long
  // slide's notes are split into pieces and played back-to-back, prefetching
  // the next piece while the current one plays — narration starts as soon as
  // the FIRST piece is ready instead of waiting for the whole slide ────────
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const pendingBufferRef = useRef<AudioBuffer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const mutedRef = useRef(muted);
  const chunkQueueRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const prefetchRef = useRef<{
    index: number;
    controller: AbortController;
    promise: Promise<AudioBuffer | null>;
  } | null>(null);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = muted ? 0 : GAIN_BOOST;
  }, [muted]);

  function ensureCtx(): AudioContext {
    if (!ctxRef.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = mutedRef.current ? 0 : GAIN_BOOST;
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
    }
    return ctxRef.current;
  }

  // Stable across the module's lifetime (total never changes).
  const advance = useCallback(() => {
    setCurrent((c) => {
      if (c + 1 < total) return c + 1;
      // Reached the end of the deck — stop and show completion rather than
      // silently idling on the last slide or looping back to the start.
      setPlaying(false);
      setFinished(true);
      return c;
    });
  }, [total]);

  async function fetchChunkBuffer(
    ctx: AudioContext,
    text: string,
    controller: AbortController,
  ): Promise<AudioBuffer | null> {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: STATIC_VOICE_ID }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return ctx.decodeAudioData(arrayBuf);
  }

  function prefetchChunk(ctx: AudioContext, index: number) {
    const queue = chunkQueueRef.current;
    if (index >= queue.length) {
      prefetchRef.current = null;
      return;
    }
    const controller = new AbortController();
    const promise = fetchChunkBuffer(ctx, queue[index], controller).catch(() => null);
    prefetchRef.current = { index, controller, promise };
  }

  const clearDwellTimer = useCallback(() => {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    prefetchRef.current?.controller.abort();
    prefetchRef.current = null;
    chunkQueueRef.current = [];
    chunkIndexRef.current = 0;
    clearDwellTimer();
    setAudioLoading(false);
    setAudioBlocked(false);
    pendingBufferRef.current = null;
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try {
        sourceRef.current.stop();
      } catch {
        // already stopped/finished
      }
      sourceRef.current = null;
    }
    setNarrating(false);
  }, [clearDwellTimer]);

  useEffect(
    () => () => {
      stopSpeech();
      ctxRef.current?.close().catch(() => {});
    },
    [stopSpeech],
  );

  const playDecodedChunk = useCallback(
    (buf: AudioBuffer, index: number) => {
      const ctx = ctxRef.current;
      const gain = gainRef.current;
      if (!ctx || !gain) return;
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.value = STATIC_SPEED;
      source.connect(gain);
      source.onended = () => {
        setNarrating(false);
        playChunkAt(index + 1);
      };
      sourceRef.current = source;
      source.start(0);
      setNarrating(true);
      setAudioBlocked(false);
      prefetchChunk(ctx, index + 1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  const playChunkAt = useCallback(
    async (index: number) => {
      const queue = chunkQueueRef.current;
      if (index >= queue.length) {
        advance();
        return;
      }
      chunkIndexRef.current = index;

      const seq = ++seqRef.current;
      let timedOut = false;
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
        prefetchRef.current?.controller.abort();
      }, 35000);

      setAudioLoading(true);
      try {
        const ctx = ensureCtx();
        const usePrefetch = prefetchRef.current?.index === index;
        const audioBuf = usePrefetch
          ? await prefetchRef.current!.promise
          : await fetchChunkBuffer(ctx, queue[index], controller);
        if (seq !== seqRef.current) return;
        setAudioLoading(false);
        if (!audioBuf) {
          toast.error("Voiceover failed for this slide.");
          return;
        }
        pendingBufferRef.current = audioBuf;
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }
        if (ctx.state === "suspended") {
          // Browser autoplay policy blocked it — surface a tap-to-enable
          // prompt instead of silently playing nothing.
          setAudioBlocked(true);
          return;
        }
        playDecodedChunk(audioBuf, index);
      } catch {
        if (seq !== seqRef.current) return;
        setAudioLoading(false);
        if (timedOut) toast.error("Voiceover timed out for this slide.");
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [advance, playDecodedChunk],
  );

  const speakSlide = useCallback(
    (idx: number) => {
      stopSpeech();
      const s = slides[idx];
      const text = (s?.notes ?? "").trim();

      // No narration to play (silent slide, or narration muted) — still
      // advance automatically after a reasonable reading pace so the deck
      // doesn't stall on a slide with nothing to say.
      if (!text || mutedRef.current) {
        dwellTimerRef.current = setTimeout(() => advance(), estimateDwellMs(text));
        return;
      }

      chunkQueueRef.current = chunkTextForTts(text);
      playChunkAt(0);
    },
    [slides, stopSpeech, advance, playChunkAt],
  );

  useEffect(() => {
    onSlideChange?.(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Re-narrate whenever the slide changes. Only runs while the learner has
  // actually pressed Play; it never fires on its own.
  useEffect(() => {
    if (!playing) return;
    speakSlide(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, playing]);

  function togglePlaying() {
    if (playing) {
      stopSpeech();
      setPlaying(false);
    } else {
      setFinished(false);
      setPlaying(true);
    }
  }

  // Manual navigation always stops whatever was playing and leaves the newly
  // selected slide silent — the learner has to press Play again to resume.
  function goTo(idx: number) {
    if (idx < 0 || idx >= total) return;
    stopSpeech();
    setPlaying(false);
    setFinished(false);
    setCurrent(idx);
  }
  function goPrev() {
    goTo(current - 1);
  }
  function goNext() {
    goTo(current + 1);
  }
  function jumpTo(idx: number) {
    goTo(idx);
    setPanelOpen(false);
  }

  function toggleMute() {
    const next = !muted;
    // Update the ref synchronously — the mirroring effect for it only runs
    // after this render commits, which is too late for the speakSlide() call
    // below (it gates on mutedRef.current and would wrongly stay silent).
    mutedRef.current = next;
    setMuted(next);
    if (next) stopSpeech();
    // Unmuting should only resume audio if the presentation is actually
    // playing — it must never be what starts narration in the first place.
    else if (playing) speakSlide(current);
  }

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await containerRef.current?.requestFullscreen().catch(() => {});
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" /> Exit Learning
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
        >
          <Settings2 className="h-4 w-4" /> Learning Controls
        </button>
      </div>

      {/* Slide area */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div
          style={{ transform: `scale(${zoom})` }}
          className="flex h-full w-full items-center justify-center transition-transform duration-200"
        >
          {pdfUrl ? (
            <PdfSlideCanvas url={pdfUrl} pageNumber={slide?.index ?? 1} cacheKey={moduleId} />
          ) : (
            <PlainSlideFallback slide={slide} />
          )}
        </div>
        {audioBlocked && (
          <button
            type="button"
            onClick={() => {
              const ctx = ctxRef.current;
              if (!ctx) {
                setAudioBlocked(false);
                return;
              }
              ctx.resume().then(() => {
                if (pendingBufferRef.current) {
                  playDecodedChunk(pendingBufferRef.current, chunkIndexRef.current);
                } else {
                  setAudioBlocked(false);
                }
              });
            }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/60"
          >
            <span className="flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg">
              <Volume2 className="h-4 w-4" /> Tap to enable voice narration
            </span>
          </button>
        )}
        {(narrating || audioLoading) && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/70">
            {audioLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Mic className="h-3 w-3 animate-pulse" />
            )}
            {audioLoading ? "Loading voice…" : "Narrating"}
          </div>
        )}
        {finished && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-success">
            <CheckCircle2 className="h-3 w-3" /> Presentation completed
          </div>
        )}
      </div>

      {/* Bottom transport */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-black/90 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            className={
              playing
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-success text-white hover:bg-success/90"
            }
            onClick={togglePlaying}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={goPrev}
            disabled={current === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            size="sm"
            className="bg-success text-white hover:bg-success/90"
            onClick={isLast ? onFinish : goNext}
          >
            {isLast ? "Finish Module" : "Next"}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <div className="text-xs text-white/70 sm:text-sm">
          Slide {current + 1} of {total}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="w-12 text-center text-xs text-white/70 hover:text-white"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={toggleMute}
            title={muted ? "Unmute narration" : "Mute narration"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <LearningControlsPanel
            moduleId={moduleId}
            slide={slide}
            slides={slides}
            current={current}
            onJump={jumpTo}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlainSlideFallback({ slide }: { slide: ParsedSlide | undefined }) {
  if (!slide) return null;
  return (
    <div className="flex h-full w-full flex-col justify-center bg-linear-to-br from-neutral-900 to-neutral-800 p-10 sm:p-16">
      <div className="text-[11px] uppercase tracking-[0.3em] text-white/40">
        Slide {slide.index}
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
        {slide.title}
      </h2>
      {slide.bullets.length > 0 && (
        <ul className="mt-6 space-y-2.5 text-sm text-white/80 sm:text-lg">
          {slide.bullets.slice(0, 8).map((b, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LearningControlsPanel({
  moduleId,
  slide,
  slides,
  current,
  onJump,
  onClose,
}: {
  moduleId: string;
  slide: ParsedSlide | undefined;
  slides: ParsedSlide[];
  current: number;
  onJump: (idx: number) => void;
  onClose: () => void;
}) {
  const noteQ = useQuery({
    queryKey: ["lp-module-note", moduleId],
    queryFn: () => getModuleNote({ moduleId }),
  });
  const [noteBody, setNoteBody] = useState("");
  useEffect(() => {
    if (noteQ.data) setNoteBody(noteQ.data.body);
  }, [noteQ.data]);

  const saveMut = useMutation({
    mutationFn: () => saveModuleNote({ moduleId, body: noteBody }),
    onSuccess: () => toast.success("Note saved"),
    onError: () => toast.error("Couldn't save your note — try again."),
  });

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
      className="fixed right-0 top-0 z-60 flex h-full w-full flex-col bg-background text-foreground shadow-2xl sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Learning Controls</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <Tabs defaultValue="notes-speaker" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-3">
          <TabsTrigger value="notes-speaker">Notes</TabsTrigger>
          <TabsTrigger value="jump">Jump</TabsTrigger>
          <TabsTrigger value="my-notes">Mine</TabsTrigger>
        </TabsList>

        <TabsContent value="notes-speaker" className="flex-1 overflow-y-auto px-4 py-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Speaker notes — slide {slide?.index ?? current + 1}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {slide?.notes?.trim() || "No speaker notes for this slide."}
          </p>
        </TabsContent>

        <TabsContent value="jump" className="flex-1 overflow-y-auto px-4 py-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Jump to slide
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.index}
                type="button"
                onClick={() => onJump(i)}
                className={`h-9 min-w-9 rounded-md border px-2 text-xs font-medium transition-colors ${
                  i === current
                    ? "border-success bg-success text-white"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                {s.index}
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-notes" className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <NotebookPen className="mr-1 inline h-3.5 w-3.5" /> Your notes
          </label>
          {noteQ.isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add personal notes here..."
                className="mt-2 min-h-40 flex-1"
              />
              <Button
                size="sm"
                className="mt-3 self-end"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Note
              </Button>
            </>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
