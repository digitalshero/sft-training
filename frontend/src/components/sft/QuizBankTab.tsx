import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCourseQuestions,
  upsertBankQuestion,
  deleteBankQuestion,
  type Course,
  type CourseModule,
} from "@/lib/learning/learning.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, Pencil, AlertTriangle } from "lucide-react";

interface Props {
  course: Course;
  modules: CourseModule[];
}

interface BankQuestion {
  id: string;
  module_id?: string | null;
  position: "mid" | "end";
  prompt: string;
  options: string[];
  correct_index: number;
  explanation?: string | null;
}

export function QuizBankTab({ course, modules }: Props) {
  const qc = useQueryClient();
  const fnList = listCourseQuestions;
  const fnDel = deleteBankQuestion;
  const q = useQuery<BankQuestion[]>({
    queryKey: ["lp-bank", course.id],
    queryFn: () => fnList({ course_id: course.id }),
  });
  const del = useMutation({
    mutationFn: fnDel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lp-bank", course.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { mid: BankQuestion[]; end: BankQuestion[] }>();
    for (const m of modules) map.set(m.id, { mid: [], end: [] });
    for (const item of q.data ?? []) {
      if (!item.module_id) continue;
      const slot = map.get(item.module_id);
      if (!slot) continue;
      slot[item.position].push(item);
    }
    return map;
  }, [q.data, modules]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quiz bank · Day-by-day</CardTitle>
          <CardDescription>
            Each day needs at least <strong>one Mid quiz</strong> (asked midway
            through the deck) and <strong>one End quiz</strong> (asked on the
            last slide). When a day has more than one question in a slot, the
            same question is shown to every partner (deterministic pick — no
            per-partner randomness).
          </CardDescription>
        </CardHeader>
      </Card>

      {modules.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Add modules first in the <strong>Slides & Modules</strong> tab. Each
            module becomes a day in the quiz bank.
          </CardContent>
        </Card>
      )}

      {modules.map((m, idx) => {
        const slot = grouped.get(m.id) ?? { mid: [], end: [] };
        const valid = slot.mid.length >= 1 && slot.end.length >= 1;
        return (
          <Card key={m.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Day {idx + 1} · {m.title}
                  </CardTitle>
                  <CardDescription>
                    {m.est_minutes ? `${m.est_minutes} min` : "Module"}
                  </CardDescription>
                </div>
                {!valid && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Needs ≥1 Mid + ≥1 End
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <SlotColumn
                title="Mid quiz"
                description="Asked at ~60% of the deck."
                items={slot.mid}
                courseId={course.id}
                moduleId={m.id}
                position="mid"
                onDelete={(id) => del.mutate({ id })}
              />
              <SlotColumn
                title="End quiz"
                description="Asked on the final slide."
                items={slot.end}
                courseId={course.id}
                moduleId={m.id}
                position="end"
                onDelete={(id) => del.mutate({ id })}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SlotColumn({
  title,
  description,
  items,
  courseId,
  moduleId,
  position,
  onDelete,
}: {
  title: string;
  description: string;
  items: BankQuestion[];
  courseId: string;
  moduleId: string;
  position: "mid" | "end";
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">{title}</div>
          <div className="text-[11px] text-muted-foreground">{description}</div>
        </div>
        <QuestionDialog
          courseId={courseId}
          moduleId={moduleId}
          position={position}
        />
      </div>
      {items.length === 0 ? (
        <div className="rounded border border-dashed border-border py-4 text-center text-[11px] text-muted-foreground">
          No questions yet.
        </div>
      ) : (
        items.map((it) => (
          <div key={it.id} className="rounded border border-border p-2 text-sm">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{it.prompt}</div>
                <ul className="mt-1 space-y-0.5">
                  {it.options.map((o, i) => (
                    <li
                      key={i}
                      className={`text-xs ${i === it.correct_index ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}`}
                    >
                      {i === it.correct_index ? "✓ " : "○ "}
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
              <QuestionDialog
                courseId={courseId}
                moduleId={moduleId}
                position={position}
                existing={it}
                icon
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm("Delete this question?")) onDelete(it.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function QuestionDialog({
  courseId,
  moduleId,
  position,
  existing,
  icon,
}: {
  courseId: string;
  moduleId: string;
  position: "mid" | "end";
  existing?: BankQuestion;
  icon?: boolean;
}) {
  const qc = useQueryClient();
  const fn = upsertBankQuestion;
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(existing?.prompt ?? "");
  const [options, setOptions] = useState<string[]>(
    existing?.options ?? ["", "", "", ""],
  );
  const [correct, setCorrect] = useState(existing?.correct_index ?? 0);
  const [explanation, setExplanation] = useState(existing?.explanation ?? "");

  const save = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(existing ? "Question updated" : "Question added");
      qc.invalidateQueries({ queryKey: ["lp-bank", courseId] });
      setOpen(false);
      if (!existing) {
        setPrompt("");
        setOptions(["", "", "", ""]);
        setCorrect(0);
        setExplanation("");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid =
    prompt.trim() &&
    options.filter((o) => o.trim()).length >= 2 &&
    options[correct]?.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {icon ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="h-3 w-3" /> Add
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit question" : "Add question"} ·{" "}
            {position === "mid" ? "Mid" : "End"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Question</Label>
            <Textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Options (mark the correct one)</Label>
            <RadioGroup
              value={String(correct)}
              onValueChange={(v) => setCorrect(Number(v))}
            >
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem value={String(i)} id={`opt-${i}`} />
                  <Input
                    value={opt}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) =>
                      setOptions(
                        options.map((o, oi) => (oi === i ? e.target.value : o)),
                      )
                    }
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setOptions(options.filter((_, oi) => oi !== i));
                        if (correct >= options.length - 1) setCorrect(0);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
            </RadioGroup>
            {options.length < 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOptions([...options, ""])}
              >
                <Plus className="h-3 w-3" /> Add option
              </Button>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Explanation (optional)</Label>
            <Textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate({
                id: existing?.id,
                course_id: courseId,
                module_id: moduleId,
                position,
                prompt: prompt.trim(),
                options: options.map((o) => o.trim()).filter(Boolean),
                correct_index: correct,
                explanation: explanation.trim() || undefined,
              })
            }
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
