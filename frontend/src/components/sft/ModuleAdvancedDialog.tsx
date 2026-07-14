import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  updateModuleAdvanced,
  type CourseModule,
  type QuizQuestion,
  type SlideOverride,
} from "@/lib/learning/learning.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Settings2, Trash2 } from "lucide-react";

const LANGS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
];

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function ModuleAdvancedDialog({
  module: m,
  supportedLanguages,
}: {
  module: CourseModule;
  supportedLanguages: string[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [voice, setVoice] = useState(m.voice ?? "alloy");
  const [language, setLanguage] = useState(m.language ?? "en");
  const [speed, setSpeed] = useState(m.speed ?? 1);
  const [autoplay, setAutoplay] = useState(m.autoplay_advance ?? true);
  const [defaultSec, setDefaultSec] = useState(m.default_slide_seconds ?? 30);
  const [overrides, setOverrides] = useState<Record<string, SlideOverride>>(
    m.slide_overrides && typeof m.slide_overrides === "object" && !Array.isArray(m.slide_overrides)
      ? (m.slide_overrides as Record<string, SlideOverride>)
      : {},
  );
  const [quizOn, setQuizOn] = useState(m.quiz_enabled ?? false);
  const [quizPass, setQuizPass] = useState(m.quiz_pass_pct ?? 70);
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    Array.isArray(m.quiz_questions) ? m.quiz_questions : [],
  );

  const fn = updateModuleAdvanced;
  const save = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Module updated");
      qc.invalidateQueries({ queryKey: ["lp-course"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const slideNumbers = Object.keys(overrides)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  function addSlideOverride() {
    const next = slideNumbers.length === 0 ? 1 : Math.max(...slideNumbers) + 1;
    setOverrides({
      ...overrides,
      [String(next)]: { duration_seconds: defaultSec, speaker_notes: "" },
    });
  }
  function removeSlide(idx: string) {
    const next = { ...overrides };
    delete next[idx];
    setOverrides(next);
  }
  function updateSlide(idx: string, patch: Partial<SlideOverride>) {
    setOverrides({ ...overrides, [idx]: { ...overrides[idx], ...patch } });
  }

  function addQuestion() {
    setQuestions([
      ...questions,
      { id: newId(), question: "", choices: ["", ""], correct_index: 0 },
    ]);
  }
  function updateQuestion(i: number, patch: Partial<QuizQuestion>) {
    setQuestions(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function removeQuestion(i: number) {
    setQuestions(questions.filter((_, idx) => idx !== i));
  }

  function submit() {
    save.mutate({
      id: m.id,
      voice: voice || null,
      language,
      speed,
      autoplay_advance: autoplay,
      default_slide_seconds: defaultSec,
      slide_overrides: overrides,
      quiz_enabled: quizOn,
      quiz_pass_pct: quizPass,
      quiz_questions: questions,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Advanced settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure "{m.title}"</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="voice">
          <TabsList>
            <TabsTrigger value="voice">Voice & Pacing</TabsTrigger>
            {m.type === "slides" && <TabsTrigger value="slides">Per-Slide</TabsTrigger>}
            <TabsTrigger value="quiz">Quiz</TabsTrigger>
          </TabsList>

          <TabsContent value="voice" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGS.filter((l) => supportedLanguages.includes(l.value)).map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Voice</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Playback speed</Label>
                <Input
                  type="number"
                  step={0.25}
                  min={0.5}
                  max={2}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default seconds per slide</Label>
                <Input
                  type="number"
                  min={1}
                  max={3600}
                  value={defaultSec}
                  onChange={(e) => setDefaultSec(Number(e.target.value))}
                />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Auto-advance to next slide when voiceover ends
                </span>
                <Switch checked={autoplay} onCheckedChange={setAutoplay} />
              </div>
            </div>
          </TabsContent>

          {m.type === "slides" && (
            <TabsContent value="slides" className="space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Set per-slide duration and speaker notes. Slides without overrides use the
                  default.
                </p>
                <Button size="sm" variant="outline" onClick={addSlideOverride}>
                  <Plus className="h-3 w-3" /> Add slide
                </Button>
              </div>
              {slideNumbers.length === 0 && (
                <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                  No per-slide overrides yet.
                </div>
              )}
              {slideNumbers.map((n) => {
                const key = String(n);
                const o: SlideOverride = overrides[key] ?? {};

                return (
                  <Card key={key}>
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Slide {n}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeSlide(key)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Title (optional)</Label>
                          <Input
                            value={o.title ?? ""}
                            onChange={(e) => updateSlide(key, { title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Duration (sec)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={o.duration_seconds ?? defaultSec}
                            onChange={(e) =>
                              updateSlide(key, { duration_seconds: Number(e.target.value) })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Speaker notes (voiceover script)</Label>
                        <Textarea
                          rows={3}
                          value={o.speaker_notes ?? ""}
                          onChange={(e) => updateSlide(key, { speaker_notes: e.target.value })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          )}

          <TabsContent value="quiz" className="space-y-3 pt-3">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">Enable end-of-module quiz</span>
              <Switch checked={quizOn} onCheckedChange={setQuizOn} />
            </div>
            {quizOn && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Pass percentage</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={quizPass}
                    onChange={(e) => setQuizPass(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Questions ({questions.length})</span>
                  <Button size="sm" variant="outline" onClick={addQuestion}>
                    <Plus className="h-3 w-3" /> Add question
                  </Button>
                </div>
                {questions.map((q, i) => (
                  <Card key={q.id}>
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Q{i + 1}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeQuestion(i)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        placeholder="Question"
                        value={q.question}
                        onChange={(e) => updateQuestion(i, { question: e.target.value })}
                      />
                      {q.choices.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={q.correct_index === ci}
                            onChange={() => updateQuestion(i, { correct_index: ci })}
                            title="Mark correct"
                          />
                          <Input
                            value={c}
                            placeholder={`Choice ${ci + 1}`}
                            onChange={(e) =>
                              updateQuestion(i, {
                                choices: q.choices.map((x, xi) => (xi === ci ? e.target.value : x)),
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={q.choices.length <= 2}
                            onClick={() =>
                              updateQuestion(i, {
                                choices: q.choices.filter((_, xi) => xi !== ci),
                                correct_index:
                                  q.correct_index >= ci && q.correct_index > 0
                                    ? q.correct_index - 1
                                    : q.correct_index,
                              })
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateQuestion(i, { choices: [...q.choices, ""] })}
                      >
                        <Plus className="h-3 w-3" /> Add choice
                      </Button>
                      <Textarea
                        rows={2}
                        placeholder="Explanation (shown after answer)"
                        value={q.explanation ?? ""}
                        onChange={(e) => updateQuestion(i, { explanation: e.target.value })}
                      />
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
