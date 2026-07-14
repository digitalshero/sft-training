import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getCourse,
  listCourseDays,
  createCourseDay,
  updateCourseDay,
  deleteCourseDay,
  reorderCourseDays,
  resetCourseDays,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  type Course,
  type CourseDay,
  type CourseModule,
  type ModuleType,
} from "@/lib/learning/learning.functions";
import { registerDeck } from "@/lib/sft-training/deck.functions";
import { uploadToStorage } from "@/lib/api/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ModuleAdvancedDialog } from "@/components/sft/ModuleAdvancedDialog";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  Video,
  BookOpen,
  Layers,
  HelpCircle,
  Save,
  RotateCcw,
} from "lucide-react";

const TYPE_META: Record<ModuleType, { icon: typeof FileText; label: string }> =
  {
    slides: { icon: Layers, label: "Slides + Voiceover" },
    video: { icon: Video, label: "Video" },
    reading: { icon: BookOpen, label: "Reading" },
    mixed: { icon: FileText, label: "Mixed" },
  };

export function ContentTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fnDays = listCourseDays;
  const fnCourse = getCourse;
  const fnCreateDay = createCourseDay;

  const days = useQuery({
    queryKey: ["lp-days", course.id],
    queryFn: () => fnDays({ course_id: course.id }),
  });
  const courseData = useQuery({
    queryKey: ["lp-course", course.id],
    queryFn: () => fnCourse({ course_id: course.id }),
  });

  const addDay = useMutation({
    mutationFn: fnCreateDay,
    onSuccess: () => {
      toast.success("Day added");
      qc.invalidateQueries({ queryKey: ["lp-days", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetDays = useMutation({
    mutationFn: () => resetCourseDays({ course_id: course.id }),
    onSuccess: () => {
      toast.success("Days reset — all topics moved to unassigned");
      qc.invalidateQueries({ queryKey: ["lp-days", course.id] });
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modulesByDay = useMemo(() => {
    const map = new Map<string, CourseModule[]>();
    for (const m of courseData.data?.modules ?? []) {
      const k = m.day_id ?? "__unassigned__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    for (const arr of map.values())
      arr.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [courseData.data]);

  if (days.isLoading || courseData.isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  const dayList = days.data ?? [];
  const unassigned = modulesByDay.get("__unassigned__") ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Days &amp; Topics</CardTitle>
            <p className="text-xs text-muted-foreground">
              A course is a sequence of days. Each day holds topics and quizzes.
              Mid-day quizzes block later topics in the same day; end-of-day
              quizzes unlock the next day.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={resetDays.isPending}
              onClick={() => {
                if (!window.confirm("Reset all days? All topics will be moved to unassigned and a fresh Day 1 will be created.")) return;
                resetDays.mutate();
              }}
            >
              {resetDays.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reset days
            </Button>
            <Button
              size="sm"
              disabled={addDay.isPending}
              onClick={() => addDay.mutate({ course_id: course.id })}
            >
              {addDay.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add day
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dayList.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              No days yet. Add your first day to start placing topics.
            </div>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={dayList.map((d) => d.id)}
              className="space-y-2"
            >
              {dayList.map((d, i) => (
                <DayRow
                  key={d.id}
                  course={course}
                  day={d}
                  modules={modulesByDay.get(d.id) ?? []}
                  first={i === 0}
                  last={i === dayList.length - 1}
                  allDays={dayList}
                />
              ))}
            </Accordion>
          )}
          {unassigned.length > 0 && (
            <div className="mt-4 space-y-2 rounded-md border border-dashed border-warning p-3">
              <div className="text-xs font-medium">
                Unassigned topics ({unassigned.length})
              </div>
              <p className="text-xs text-muted-foreground">
                These topics aren't on any day. Move them into a day from the
                topic settings.
              </p>
              {unassigned.map((m) => (
                <TopicRow
                  key={m.id}
                  module={m}
                  course={course}
                  allDays={dayList}
                  compact
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DayRow({
  course,
  day,
  modules,
  first,
  last,
  allDays,
}: {
  course: Course;
  day: CourseDay;
  modules: CourseModule[];
  first: boolean;
  last: boolean;
  allDays: CourseDay[];
}) {
  const qc = useQueryClient();
  const fnUpd = updateCourseDay;
  const fnDel = deleteCourseDay;
  const fnReorderDays = reorderCourseDays;
  const fnReorderMods = reorderModules;
  const [title, setTitle] = useState(day.title);
  const [unlock, setUnlock] = useState(day.unlock_after_days);

  const upd = useMutation({
    mutationFn: fnUpd,
    onSuccess: () => {
      toast.success("Day saved");
      qc.invalidateQueries({ queryKey: ["lp-days", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: fnDel,
    onSuccess: () => {
      toast.success("Day deleted");
      qc.invalidateQueries({ queryKey: ["lp-days", course.id] });
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reorder = useMutation({
    mutationFn: fnReorderDays,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lp-days", course.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const reorderMods = useMutation({
    mutationFn: fnReorderMods,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function moveDay(dir: -1 | 1) {
    const ids = allDays.map((d) => d.id);
    const i = ids.indexOf(day.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder.mutate({ course_id: course.id, order: ids });
  }

  function moveModule(idx: number, dir: -1 | 1) {
    const next = [...modules];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    reorderMods.mutate({ course_id: course.id, order: next.map((m) => m.id) });
  }

  return (
    <AccordionItem value={day.id} className="rounded-md border border-border">
      <div className="flex items-center gap-2 px-3">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={first}
            onClick={() => moveDay(-1)}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={last}
            onClick={() => moveDay(1)}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
        <AccordionTrigger className="flex-1 hover:no-underline">
          <div className="flex w-full items-center justify-between gap-3 pr-3 text-left">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Day {day.day_no}</Badge>
              <span className="font-medium">{day.title || "Untitled day"}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {modules.length} item{modules.length === 1 ? "" : "s"}
              {day.unlock_after_days > 0 &&
                ` · unlocks +${day.unlock_after_days}d`}
            </span>
          </div>
        </AccordionTrigger>
      </div>
      <AccordionContent className="space-y-3 px-4 pb-4">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Unlock N days after previous day completion
            </Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={unlock}
              onChange={(e) => setUnlock(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={allDays.length <= 1 || del.isPending}
            title={
              allDays.length <= 1
                ? "A course must have at least one day"
                : undefined
            }
            onClick={() => {
              if (allDays.length <= 1) {
                toast.error(
                  "A course must have at least one day. Add another day first.",
                );
                return;
              }
              if (
                confirm(
                  `Delete "${day.title || `Day ${day.day_no}`}"? Its topics will move to the previous day.`,
                )
              ) {
                del.mutate({ id: day.id });
              }
            }}
          >
            <Trash2 className="h-3 w-3 text-destructive" /> Delete day
          </Button>

          <div className="flex gap-2">
            <AddTopicDialog course={course} day={day} kind="topic" />
            <AddTopicDialog course={course} day={day} kind="mid_day" />
            <AddTopicDialog course={course} day={day} kind="end_of_day" />
            <Button
              size="sm"
              variant="outline"
              disabled={
                upd.isPending ||
                (title === day.title && unlock === day.unlock_after_days)
              }
              onClick={() =>
                upd.mutate({ id: day.id, title, unlock_after_days: unlock })
              }
            >
              {upd.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save day
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {modules.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
              No topics yet on this day.
            </div>
          ) : (
            modules.map((m, i) => (
              <TopicRow
                key={m.id}
                course={course}
                module={m}
                allDays={allDays}
                first={i === 0}
                last={i === modules.length - 1}
                onMove={(dir) => moveModule(i, dir)}
              />
            ))
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function TopicRow({
  course,
  module: m,
  allDays,
  first,
  last,
  onMove,
  compact,
}: {
  course: Course;
  module: CourseModule;
  allDays: CourseDay[];
  first?: boolean;
  last?: boolean;
  onMove?: (dir: -1 | 1) => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const fnUpd = updateModule;
  const fnDel = deleteModule;
  const Icon = TYPE_META[m.type].icon;

  const upd = useMutation({
    mutationFn: fnUpd,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: fnDel,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const placementBadge =
    m.quiz_placement === "mid_day" ? (
      <Badge variant="secondary" className="text-[10px]">
        Mid-day quiz
      </Badge>
    ) : m.quiz_placement === "end_of_day" ? (
      <Badge variant="default" className="text-[10px]">
        End-of-day quiz
      </Badge>
    ) : null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!compact && onMove && (
          <div className="flex flex-col">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={first}
              onClick={() => onMove(-1)}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              disabled={last}
              onClick={() => onMove(1)}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        )}
        {m.quiz_placement !== "topic" ? (
          <HelpCircle className="h-4 w-4 shrink-0 text-accent" />
        ) : (
          <Icon className="h-4 w-4 shrink-0 text-accent" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-medium">
            <span className="min-w-0 flex-1 truncate">{m.title}</span>
            {placementBadge}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{TYPE_META[m.type].label}</span>
            {m.est_minutes ? <span>· {m.est_minutes} min</span> : null}
            {m.type === "slides" && !m.deck_id && (
              <Badge variant="destructive" className="text-[10px]">
                No deck
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <Select
          value={m.day_id ?? "__none__"}
          onValueChange={(v) =>
            upd.mutate({ id: m.id, day_id: v === "__none__" ? null : v })
          }
        >
          <SelectTrigger className="h-8 w-30">
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {allDays.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                Day {d.day_no}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Switch
          checked={m.published}
          onCheckedChange={(v) => upd.mutate({ id: m.id, published: v })}
        />
        <ModuleAdvancedDialog
          module={m}
          supportedLanguages={course.supported_languages ?? ["en"]}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (confirm(`Delete "${m.title}"?`)) del.mutate({ id: m.id });
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function AddTopicDialog({
  course,
  day,
  kind,
}: {
  course: Course;
  day: CourseDay;
  kind: "topic" | "mid_day" | "end_of_day";
}) {
  const qc = useQueryClient();
  const fnCreate = createModule;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ModuleType>(
    kind === "topic" ? "slides" : "reading",
  );
  const [videoUrl, setVideoUrl] = useState("");
  const [reading, setReading] = useState("");
  const [est, setEst] = useState(kind === "topic" ? 15 : 5);

  const pptxRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pptxFile, setPptxFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const create = useMutation({
    mutationFn: fnCreate,
    onSuccess: () => {
      toast.success(
        kind === "topic"
          ? "Topic added"
          : kind === "mid_day"
            ? "Mid-day quiz added"
            : "End-of-day quiz added",
      );
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
      setOpen(false);
      setTitle("");
      setVideoUrl("");
      setReading("");
      setPptxFile(null);
      setPdfFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const label =
    kind === "topic"
      ? "Add topic"
      : kind === "mid_day"
        ? "Add mid-day quiz"
        : "Add end-of-day quiz";

  const showDeckUpload = type === "slides" || type === "mixed";
  const showVideoField = type === "video" || type === "mixed";
  const showReadingField = type === "reading" || type === "mixed";

  async function submit() {
    let deckId: string | undefined;
    let filePath: string | undefined;

    if (showDeckUpload && pptxFile) {
      setUploading(true);
      try {
        const safe = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_");
        const ts = Date.now();
        const pptxPath = `decks/${course.id}/${day.id}/${ts}_${safe(pptxFile.name)}`;

        const pptxErr = await uploadToStorage("sft-decks", pptxPath, pptxFile);
        if (pptxErr) throw new Error(`PPTX upload failed: ${pptxErr}`);
        filePath = pptxPath;

        let pdfPath: string | null = null;
        if (pdfFile) {
          pdfPath = `decks/${course.id}/${day.id}/${ts}_${safe(pdfFile.name)}`;
          const pdfErr = await uploadToStorage("sft-decks", pdfPath, pdfFile);
          if (pdfErr) throw new Error(`PDF upload failed: ${pdfErr}`);
        }

        const deck = await registerDeck({
          name: title || pptxFile.name.replace(/\.pptx$/i, ""),
          file_path: pptxPath,
          pdf_path: pdfPath,
        });
        deckId = (deck as { id: string }).id;
        console.log("[AddTopicDialog] deck created:", deckId);
      } catch (err) {
        toast.error((err as Error).message);
        setUploading(false);
        return;
      }
      setUploading(false);
    } else if (showDeckUpload && !pptxFile) {
      toast.error(
        "Please choose a PPTX file (it contains both slide visuals and speaker notes).",
      );
      return;
    }

    const payload = {
      course_id: course.id,
      day_id: day.id,
      type,
      title:
        title ||
        (kind === "topic"
          ? "New topic"
          : kind === "mid_day"
            ? "Mid-day quiz"
            : "End-of-day quiz"),
      est_minutes: est,
      deck_id: deckId,
      file_path: filePath,
      video_url: showVideoField ? videoUrl || undefined : undefined,
      reading_md: showReadingField ? reading || undefined : undefined,
      quiz_placement: kind,
    };
    console.log("[AddTopicDialog] creating module with payload:", payload);
    create.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={kind === "topic" ? "default" : "outline"}>
          <Plus className="h-3 w-3" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {label} — Day {day.day_no}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as ModuleType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slides">Slides + Voiceover</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="reading">Reading</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estimated minutes</Label>
              <Input
                type="number"
                min={1}
                value={est}
                onChange={(e) => setEst(Number(e.target.value))}
              />
            </div>
          </div>

          {showDeckUpload && (
            <div className="space-y-2 rounded-md border border-dashed border-border p-3">
              <Label className="text-xs">
                Slide deck — upload your PPTX (contains slides + speaker notes
                for voiceover)
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => pptxRef.current?.click()}
                  className="justify-start"
                >
                  <Layers className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {pptxFile ? pptxFile.name : "Choose PPTX (required)"}
                  </span>
                </Button>
                <input
                  ref={pptxRef}
                  type="file"
                  accept=".pptx"
                  className="sr-only"
                  onChange={(e) => setPptxFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => pdfRef.current?.click()}
                  className="justify-start"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {pdfFile ? pdfFile.name : "Choose PDF (optional)"}
                  </span>
                </Button>
                <input
                  ref={pdfRef}
                  type="file"
                  accept=".pdf"
                  className="sr-only"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                The PPTX's slide content renders to the partner, and its speaker
                notes are read aloud as the voiceover. Add a PDF only if you
                want pixel-perfect rendering instead of the parsed layout.
              </p>
            </div>
          )}

          {showVideoField && (
            <div className="space-y-1">
              <Label className="text-xs">Video URL</Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://... (YouTube, Vimeo, or direct video link)"
              />
            </div>
          )}

          {showReadingField && (
            <div className="space-y-1">
              <Label className="text-xs">Reading (markdown)</Label>
              <Textarea
                rows={4}
                value={reading}
                onChange={(e) => setReading(e.target.value)}
              />
            </div>
          )}

          {kind !== "topic" && (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              Add quiz questions from the topic's Advanced settings (the cog
              icon) after creation, or from the Quizzes tab.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button disabled={create.isPending || uploading} onClick={submit}>
            {(create.isPending || uploading) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {uploading ? "Uploading…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
