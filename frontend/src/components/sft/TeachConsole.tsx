// Trainer-led live-teach console. Wraps DeckPlayer with trainer chrome:
// fullscreen toggle, per-slide elapsed/target timer, language label, and
// applies module-level slide overrides (custom speaker notes/durations).

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Maximize2, Minimize2, Hand, Timer } from "lucide-react";
import { DeckPlayer } from "@/components/sft-training/DeckPlayer";
import type { ParsedSlide } from "@/lib/sft-training/pptx-parser";
import type { CourseModule } from "@/lib/learning/learning.functions";

interface Props {
  slides: ParsedSlide[];
  module: CourseModule;
  deckName: string;
  pdfUrl?: string | null;
}

const LANG_LABEL: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  mr: "मराठी",
  es: "Español",
  fr: "Français",
};

export function TeachConsole({ slides, module, deckName, pdfUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [status, setStatus] = useState<string>("idle");
  const [elapsed, setElapsed] = useState(0);

  // Apply per-slide speaker-note overrides to drive the voiceover.
  const effectiveSlides = useMemo<ParsedSlide[]>(() => {
    const overrides = module.slide_overrides ?? {};
    return slides.map((s) => {
      const key = String(s.index);
      const ov = overrides[key];
      if (!ov) return s;
      return {
        ...s,
        title: ov.title ?? s.title,
        notes: ov.speaker_notes && ov.speaker_notes.length > 0 ? ov.speaker_notes : s.notes,
      };
    });
  }, [slides, module.slide_overrides]);

  const targetSeconds = useMemo(() => {
    const ov = module.slide_overrides?.[String(slides[currentIdx]?.index ?? "")];
    return ov?.duration_seconds ?? module.default_slide_seconds ?? 45;
  }, [module, slides, currentIdx]);

  // Reset per-slide timer on slide change.
  useEffect(() => {
    setElapsed(0);
  }, [currentIdx]);
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [status, currentIdx]);

  // Track fullscreen state.
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleFs() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await el.requestFullscreen().catch(() => {});
  }

  const overSec = elapsed > targetSeconds;
  const langLabel = LANG_LABEL[module.language] ?? module.language;

  return (
    <div ref={containerRef} className="bg-background">
      <Card className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">Trainer mode</Badge>
            <Badge variant="outline">{langLabel}</Badge>
            <Badge variant="outline">Voice: {module.voice ?? "alloy"}</Badge>
            <Badge variant="outline">Speed {module.speed.toFixed(2)}×</Badge>
            <Badge variant={module.autoplay_advance ? "default" : "secondary"}>
              {module.autoplay_advance ? "Auto-advance" : "Manual advance"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono ${
                overSec
                  ? "border-destructive/40 text-destructive bg-destructive/5"
                  : "border-border text-muted-foreground"
              }`}
              title="Per-slide timer"
            >
              <Timer className="h-3 w-3" />
              {fmt(elapsed)} / {fmt(targetSeconds)}
            </div>
            <Button size="sm" variant="outline" onClick={toggleFs}>
              {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFs ? "Exit" : "Fullscreen"}
            </Button>
          </div>
        </div>

        <DeckPlayer
          slides={effectiveSlides}
          voice={module.voice ?? "alloy"}
          speed={module.speed}
          autoAdvance={module.autoplay_advance}
          deckName={deckName}
          pdfUrl={pdfUrl ?? null}
          minDurationSec={module.default_slide_seconds ?? undefined}
          language={module.language ?? "en"}
          onSlideChange={(idx) => setCurrentIdx(idx)}
          onStatusChange={(s) => setStatus(s)}
        />

        <div className="rounded-md border border-dashed border-border bg-surface-elevated/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Hand className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <span className="font-medium text-foreground">Hold for Q&amp;A:</span> Press{" "}
            <kbd className="px-1 rounded bg-muted">Pause</kbd> any time to stop the voiceover. Use{" "}
            <kbd className="px-1 rounded bg-muted">Next</kbd>/
            <kbd className="px-1 rounded bg-muted">Prev</kbd> to navigate. The per-slide timer turns
            red once you exceed the target duration.
          </span>
        </div>
      </Card>
    </div>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
