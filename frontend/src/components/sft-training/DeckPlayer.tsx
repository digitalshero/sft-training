// Autoplay deck player. Renders the parsed slide and narrates the slide's
// speaker notes verbatim using /api/tts (MP3). The slide advances
// only when BOTH the per-slide minimum duration AND the voiceover have
// finished — whichever takes longer — per the trainer's brief.

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  RotateCcw,
  Repeat,
  Settings2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ParsedSlide } from "@/lib/sft-training/pptx-parser";
import { PdfSlideCanvas } from "./PdfSlideCanvas";

interface Props {
  slides: ParsedSlide[];
  voice: string; // initial / default voice
  speed: number; // initial / default speed
  autoAdvance: boolean;
  deckName: string;
  /** Per-slide minimum visible time, in seconds, keyed by slide index. */
  minDurationSec?: number;
  /** Initial language code from course/module config (e.g. "en", "hi", "ta") */
  language?: string;
  /** Optional signed URL to the PDF deck. When provided, the player renders PDF pages
   *  pixel-perfect instead of the parsed PPTX layout. */
  pdfUrl?: string | null;
  onSlideChange?: (idx: number, slide: ParsedSlide) => void;
  onStatusChange?: (status: Status) => void;
}

type Status =
  "idle" | "loading" | "playing" | "paused" | "ended" | "waiting-duration";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
];

const PITCHES = [
  { value: "low", label: "Low" },
  { value: "natural", label: "Natural" },
  { value: "high", label: "High" },
];

const LANG_TO_LOCALE: Record<string, string> = {
  en: "en-US",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
};

export function DeckPlayer({
  slides,
  voice: _voice,
  speed,
  autoAdvance,
  deckName,
  minDurationSec = 0,
  language: initialLanguage = "en",
  pdfUrl,
  onSlideChange,
  onStatusChange,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(false);
  // user-adjustable playback config
  const [selSpeed, setSelSpeed] = useState(speed);
  const [selLang, setSelLang] = useState(initialLanguage);
  const [selPitch, setSelPitch] = useState<"low" | "natural" | "high">(
    "natural",
  );

  useEffect(() => {
    onSlideChange?.(current, slides[current]);
  }, [current, slides, onSlideChange]);
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceFiredRef = useRef(false);
  const autoAdvanceRef = useRef(autoAdvance);
  const mutedRef = useRef(muted);
  useEffect(() => {
    autoAdvanceRef.current = autoAdvance;
  }, [autoAdvance]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const slide = slides[current];
  const total = slides.length;

  function stopAudio() {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    speechSynthesis.cancel();
    utterRef.current = null;
  }

  useEffect(
    () => () => {
      stopAudio();
    },
    [],
  );

  function playSlide(idx: number) {
    stopAudio();
    advanceFiredRef.current = false;
    setCurrent(idx);
    const s = slides[idx];
    if (!s) return;
    const text = (s.notes ?? "").trim();

    if (!text) {
      setStatus("waiting-duration");
      const minMs = Math.max(0, (minDurationSec ?? 0) * 1000);
      advanceTimerRef.current = setTimeout(() => {
        if (advanceFiredRef.current) return;
        advanceFiredRef.current = true;
        setStatus("ended");
        if (autoAdvanceRef.current && idx + 1 < slides.length)
          playSlide(idx + 1);
      }, minMs + 200);
      return;
    }

    setStatus("playing");
    const utter = new SpeechSynthesisUtterance(text);
    const locale = LANG_TO_LOCALE[selLang] ?? "en-US";
    utter.lang = locale;
    utter.rate = Math.min(2, Math.max(0.1, selSpeed));
    utter.pitch = selPitch === "low" ? 0.5 : selPitch === "high" ? 1.5 : 1;
    utter.volume = mutedRef.current ? 0 : 1;
    const femaleVoice =
      speechSynthesis
        .getVoices()
        .find(
          (v) =>
            v.lang.startsWith(locale.split("-")[0]) &&
            /female|zira|samantha|karen|victoria|moira|fiona|veena|google uk english female/i.test(
              v.name,
            ),
        ) ??
      speechSynthesis
        .getVoices()
        .find((v) => v.lang.startsWith(locale.split("-")[0]));
    if (femaleVoice) utter.voice = femaleVoice;
    utterRef.current = utter;

    const slideStartMs = Date.now();
    const onDone = () => {
      if (utterRef.current !== utter) return;
      const elapsed = Date.now() - slideStartMs;
      const minMs = Math.max(0, (minDurationSec ?? 0) * 1000);
      const remaining = Math.max(0, minMs - elapsed);
      advanceTimerRef.current = setTimeout(() => {
        if (advanceFiredRef.current) return;
        advanceFiredRef.current = true;
        setStatus("ended");
        if (autoAdvanceRef.current && idx + 1 < slides.length)
          playSlide(idx + 1);
      }, remaining + 200);
    };
    utter.onend = onDone;
    utter.onerror = onDone;
    speechSynthesis.speak(utter);
  }

  function handlePlay() {
    if (status === "playing" || status === "loading") return;
    playSlide(current);
  }
  function handlePause() {
    stopAudio();
    setStatus("paused");
  }
  function handlePrev() {
    if (current === 0) return;
    const next = current - 1;
    if (status === "playing" || status === "loading") playSlide(next);
    else {
      stopAudio();
      setCurrent(next);
      setStatus("idle");
    }
  }
  function handleNext() {
    if (current + 1 >= total) return;
    const next = current + 1;
    if (status === "playing" || status === "loading") playSlide(next);
    else {
      stopAudio();
      setCurrent(next);
      setStatus("idle");
    }
  }
  function handleRestartSlide() {
    playSlide(current);
  }
  function handleRestartDeck() {
    playSlide(0);
  }
  function jumpTo(idx: number) {
    if (status === "playing" || status === "loading") playSlide(idx);
    else {
      stopAudio();
      setCurrent(idx);
      setStatus("idle");
    }
  }

  const progressPct = useMemo(
    () => (total ? Math.round(((current + 1) / total) * 100) : 0),
    [current, total],
  );

  if (!slide) {
    return (
      <Card className="p-8 text-sm text-muted-foreground">
        No slides parsed.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="truncate">
          <span className="font-medium text-foreground">{deckName}</span>
          <span className="mx-2">·</span>
          Slide {current + 1} of {total}
        </div>
        <div className="flex-1 max-w-md">
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <Card
        className="relative w-full overflow-hidden bg-black/90"
        style={{ height: "calc(100vh - 260px)", minHeight: "420px" }}
      >
        {pdfUrl ? (
          <PdfSlideCanvas url={pdfUrl} pageNumber={slide.index} />
        ) : (
          <div className="relative h-full w-full p-10 bg-gradient-to-br from-background to-surface-elevated/40">
            <div className="absolute top-6 left-10 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Slide {slide.index}
            </div>
            <div className="flex h-full flex-col justify-center">
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                {slide.title}
              </h2>
              {slide.bullets.length > 0 && (
                <ul className="mt-6 space-y-2 text-base text-muted-foreground md:text-lg">
                  {slide.bullets.slice(0, 8).map((b, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{b}</span>
                    </li>
                  ))}
                  {slide.bullets.length > 8 && (
                    <li className="text-xs italic text-muted-foreground/60">
                      +{slide.bullets.length - 8} more lines on this slide…
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
        {status === "loading" && (
          <div className="absolute bottom-4 right-6 text-[10px] uppercase tracking-wider text-muted-foreground animate-pulse">
            Loading voiceover…
          </div>
        )}
        {status === "playing" && (
          <div className="absolute bottom-4 right-6 flex items-center gap-2 text-[10px] uppercase tracking-wider text-accent">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            Narrating
          </div>
        )}
        {status === "waiting-duration" && (
          <div className="absolute bottom-4 right-6 text-[10px] uppercase tracking-wider text-muted-foreground">
            Holding for slide duration…
          </div>
        )}
      </Card>

      {/* Primary transport */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrev}
            disabled={current === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          {status === "playing" || status === "loading" ? (
            <Button size="sm" onClick={handlePause}>
              <Pause className="h-4 w-4" /> Pause
            </Button>
          ) : (
            <Button size="sm" onClick={handlePlay}>
              <Play className="h-4 w-4" />{" "}
              {status === "ended" ? "Replay" : "Play"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleNext}
            disabled={current + 1 >= total}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRestartSlide}
            title="Restart this slide"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRestartDeck}
            title="Restart deck from slide 1"
          >
            <Repeat className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMuted((m) => !m)}>
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                title="Voice & playback settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-3">
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider">
                  Language
                </Label>
                <Select value={selLang} onValueChange={setSelLang}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider">
                  Speed · {selSpeed.toFixed(2)}×
                </Label>
                <Slider
                  value={[selSpeed]}
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  onValueChange={(v) => setSelSpeed(v[0])}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wider">
                  Pitch
                </Label>
                <Select
                  value={selPitch}
                  onValueChange={(v) =>
                    setSelPitch(v as "low" | "natural" | "high")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PITCHES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="rounded-md border border-dashed border-border bg-muted/30 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                Changes apply on the next play / restart. Slide advances when
                the minimum duration AND the voiceover have both finished.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Jump</span>
          <div className="w-48">
            <Slider
              value={[current]}
              min={0}
              max={Math.max(0, total - 1)}
              step={1}
              onValueChange={(v) => jumpTo(v[0])}
            />
          </div>
        </div>
      </div>

      {slide.notes && (
        <details className="rounded-lg border border-border bg-surface-elevated/30 p-4 text-sm">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
            Speaker notes (voiceover script)
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
            {slide.notes}
          </p>
        </details>
      )}
    </div>
  );
}
