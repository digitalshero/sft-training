import { createFileRoute, Link } from "@tanstack/react-router";
import { uploadToStorage } from "@/lib/api/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  listPrograms,
  listCoursesForProgram,
  listCourseDays,
  createCourse,
  updateCourse,
  getCourseDeck,
  uploadCourseDeck,
  getCourseTeachData,
  type Course,
} from "@/lib/learning/learning.functions";
import { parsePptx, type ParsedSlide } from "@/lib/sft-training/pptx-parser";
import { TeachConsole } from "@/components/sft/TeachConsole";
import api from "@/lib/api/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Settings2,
  BookOpen,
  UploadCloud,
  FileText,
  PlayCircle,
  Pencil,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/sft-training/program")({
  component: ProgramPage,
});

function ProgramPage() {
  const qc = useQueryClient();
  const fnPrograms = listPrograms;
  const fnCourses = listCoursesForProgram;

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

  const updateMut = useMutation({
    mutationFn: updateCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lp-courses"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (progQ.isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  if (!program) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No program found. Please contact support.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{program.title}</CardTitle>
              <CardDescription>{program.summary}</CardDescription>
            </div>
            <Badge variant={program.published ? "default" : "secondary"}>
              {program.published ? "Published" : "Draft"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Courses</h2>
        <NewCourseDialog programId={program.id} />
      </div>

      {coursesQ.isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(coursesQ.data ?? []).map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              onTogglePublished={(v) =>
                updateMut.mutate({ course_id: c.id, published: v })
              }
              onUpdate={(data) => updateMut.mutate(data)}
            />
          ))}
          {(coursesQ.data ?? []).length === 0 && (
            <Card className="border-dashed md:col-span-2">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No courses yet. Add one to get started.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CourseCard({
  course,
  onTogglePublished,
  onUpdate,
}: {
  course: Course;
  onTogglePublished: (v: boolean) => void;
  onUpdate: (data: { course_id: string; title: string; summary: string; duration_label?: string; pass_pct?: number }) => void;
}) {
  const qc = useQueryClient();
  const fnGetDeck = getCourseDeck;
  const fnUpload = uploadCourseDeck;
  const pptxRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pptxFile, setPptxFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(course.title);
  const [editSummary, setEditSummary] = useState(course.summary ?? "");
  const [editDuration, setEditDuration] = useState(course.duration_label ?? "");
  const [editPassPct, setEditPassPct] = useState(course.pass_pct);

  const deckQ = useQuery({
    queryKey: ["lp-course-deck", course.id],
    queryFn: () => fnGetDeck({ course_id: course.id }),
  });

  const daysQ = useQuery({
    queryKey: ["lp-course-days", course.id],
    queryFn: () => listCourseDays({ course_id: course.id }),
  });
  const daysCount = daysQ.data?.length ?? 0;

  const uploadMut = useMutation({
    mutationFn: async ({ pptx, pdf }: { pptx: File; pdf: File }) => {
      if (!pptx.name.toLowerCase().endsWith(".pptx")) {
        throw new Error("Speaker-notes file must be a .pptx");
      }
      if (!pdf.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Slide-visual file must be a .pdf");
      }
      if (pptx.size > 50 * 1024 * 1024 || pdf.size > 50 * 1024 * 1024) {
        throw new Error("Each file must be under 50MB");
      }
      const safe = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ts = Date.now();
      const pptxPath = `decks/${course.id}/${ts}_${safe(pptx.name)}`;
      const pdfPath = `decks/${course.id}/${ts}_${safe(pdf.name)}`;
      const [upPptxErr, upPdfErr] = await Promise.all([
        uploadToStorage("sft-decks", pptxPath, pptx),
        uploadToStorage("sft-decks", pdfPath, pdf),
      ]);
      if (upPptxErr) throw new Error(upPptxErr);
      if (upPdfErr) throw new Error(upPdfErr);
      return fnUpload({
        course_id: course.id,
        name: pptx.name.replace(/\.pptx$/i, ""),
        file_path: pptxPath,
        pdf_path: pdfPath,
      });
    },
    onSuccess: () => {
      toast.success("Deck uploaded — PDF visual + PPTX speaker notes attached");
      setPptxFile(null);
      setPdfFile(null);
      qc.invalidateQueries({ queryKey: ["lp-course-deck", course.id] });
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
      qc.invalidateQueries({ queryKey: ["preview-teach", course.id] });
      qc.invalidateQueries({ queryKey: ["teach-data", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function trySubmit() {
    if (pptxFile && pdfFile) {
      uploadMut.mutate({ pptx: pptxFile, pdf: pdfFile });
    }
  }

  const deck = deckQ.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" />
              <CardTitle className="text-base">{course.title}</CardTitle>
              <button
                onClick={() => {
                  setEditTitle(course.title);
                  setEditSummary(course.summary ?? "");
                  setEditOpen(true);
                }}
                className="ml-auto p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit course details"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <CardDescription className="mt-1 line-clamp-2">
              {course.summary || "No description"}
            </CardDescription>
          </div>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit course</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Course name</Label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. SFT Overview"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    placeholder="Short description shown on the course card"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Duration</Label>
                    <Input
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      placeholder="e.g. 30 mins"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pass % (≥)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editPassPct}
                      onChange={(e) => setEditPassPct(Number(e.target.value))}
                      placeholder="e.g. 60"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={!editTitle.trim()}
                  onClick={() => {
                    onUpdate({
                      course_id: course.id,
                      title: editTitle.trim(),
                      summary: editSummary.trim(),
                      duration_label: editDuration.trim() || undefined,
                      pass_pct: editPassPct,
                    });
                    setEditOpen(false);
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Switch
            checked={course.published}
            onCheckedChange={onTogglePublished}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{course.duration_label ?? "—"}</Badge>
          <Badge variant="outline">Pass ≥ {course.pass_pct}%</Badge>
          <Badge variant="outline">
            {daysQ.isLoading ? "…" : `${daysCount} day${daysCount !== 1 ? "s" : ""} upload`}
          </Badge>
          {course.issues_certificate && (
            <Badge variant="outline">Certificate</Badge>
          )}
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate text-muted-foreground flex-1">
              {deckQ.isLoading
                ? "Loading deck…"
                : deck
                  ? `${deck.name}${deck.pdf_path ? " · PDF + PPTX" : " · PPTX only — replace to show exact slides"}`
                  : "No slide deck uploaded yet"}
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Visual (PDF)
              </Label>
              <input
                ref={pdfRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  setPdfFile(e.target.files?.[0] ?? null);
                  if (pdfRef.current) pdfRef.current.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => pdfRef.current?.click()}
                disabled={uploadMut.isPending}
              >
                <UploadCloud className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {pdfFile?.name ?? "Choose PDF"}
                </span>
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Speaker notes (PPTX)
              </Label>
              <input
                ref={pptxRef}
                type="file"
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="hidden"
                onChange={(e) => {
                  setPptxFile(e.target.files?.[0] ?? null);
                  if (pptxRef.current) pptxRef.current.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => pptxRef.current?.click()}
                disabled={uploadMut.isPending}
              >
                <UploadCloud className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  {pptxFile?.name ?? "Choose PPTX"}
                </span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground leading-tight">
              PDF renders pixel-perfect to the partner. PPTX is parsed for
              speaker notes used as the voiceover script. Use the{" "}
              <span className="font-medium text-foreground">Pitch Player</span>{" "}
              below to test voice, speed, language, pitch & slide duration
              controls.
            </p>
            <Button
              size="sm"
              onClick={trySubmit}
              disabled={!pptxFile || !pdfFile || uploadMut.isPending}
            >
              {uploadMut.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <UploadCloud className="h-3 w-3" />
              )}
              {deck ? "Replace deck" : "Upload deck"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild size="sm" variant="default" disabled={!deck}>
            <Link
              to="/sft-training/play/$courseId"
              params={{ courseId: course.id }}
            >
              <PlayCircle className="h-3 w-3" /> Open Pitch Player
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/sft-training/courses/$courseId"
              params={{ courseId: course.id }}
            >
              <Settings2 className="h-3 w-3" /> Configure modules & quiz
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewDeckDialog({
  courseId,
  disabled,
}: {
  courseId: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fn = getCourseTeachData;
  const q = useQuery({
    queryKey: ["preview-teach", courseId],
    enabled: open,
    queryFn: () => fn({ course_id: courseId }),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const [slides, setSlides] = useState<ParsedSlide[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSlides(null);
      setErr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!q.data?.deckUrl || !q.data?.pdfUrl) return;
      try {
        const res = await fetch(q.data.deckUrl);
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const buf = await res.arrayBuffer();
        const parsed = await parsePptx(buf);
        if (!cancelled) setSlides(parsed);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, q.data?.deckUrl, q.data?.pdfUrl]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <PlayCircle className="h-3 w-3" /> Preview partner view
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Partner preview — exactly as the learner will see it
          </DialogTitle>
        </DialogHeader>
        {q.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : err ? (
          <p className="text-sm text-destructive py-6 text-center">{err}</p>
        ) : !q.data?.module || !q.data?.deck ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Add a slides module in the builder, then upload the deck to preview.
          </p>
        ) : !q.data.pdfUrl ? (
          <Card className="border-dashed border-accent/50">
            <CardContent className="py-8 space-y-3">
              <p className="text-sm font-semibold text-foreground text-center">
                No PDF attached to this deck yet.
              </p>
              <ol className="mx-auto max-w-xl text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>
                  On the course card, click{" "}
                  <span className="font-medium text-foreground">
                    Choose PDF
                  </span>{" "}
                  and pick the slide visual.
                </li>
                <li>
                  Click{" "}
                  <span className="font-medium text-foreground">
                    Choose PPTX
                  </span>{" "}
                  and pick the matching speaker-notes file.
                </li>
                <li>
                  Click the green{" "}
                  <span className="font-medium text-foreground">
                    Replace deck
                  </span>{" "}
                  button — this uploads both files and saves them.
                </li>
                <li>Reopen this preview.</li>
              </ol>
              <p className="mx-auto max-w-xl text-xs text-muted-foreground text-center pt-2">
                Selecting files in the pickers only stages them — nothing is
                saved until you click{" "}
                <span className="font-medium">Replace deck</span>.
              </p>
            </CardContent>
          </Card>
        ) : !slides ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : (
          <TeachConsole
            slides={slides!}
            module={q.data.module}
            deckName={q.data.deck.name}
            pdfUrl={q.data.pdfUrl}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewCourseDialog({ programId }: { programId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const createMut = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      toast.success("Course created");
      qc.invalidateQueries({ queryKey: ["lp-courses"] });
      setOpen(false);
      setTitle("");
      setSummary("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function slugify(s: string) {
    return (
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `course-${Date.now()}`
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Course name</Label>
            <Input
              value={title}
              placeholder="e.g. SFT Overview"
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={summary}
              placeholder="Short description shown on the course card"
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!title.trim() || createMut.isPending}
            onClick={() =>
              createMut.mutate({
                program_id: programId,
                title: title.trim(),
                slug: slugify(title),
                summary: summary.trim() || undefined,
              })
            }
          >
            {createMut.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
