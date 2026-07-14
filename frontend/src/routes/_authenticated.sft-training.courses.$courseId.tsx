import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getCourse,
  updateCourse,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  type CourseModule,
  type ModuleType,
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
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleAdvancedDialog } from "@/components/sft/ModuleAdvancedDialog";
import {
  ProductBriefTab,
  InspectionTab,
  CertificateTab,
  LanguagesEditor,
} from "@/components/sft/CourseBuilderTabs";

import { WelcomeLetterTab } from "@/components/sft/WelcomeLetterTab";
import { ResourcesPanel, VideosPanel } from "@/components/sft/PartnerHubAdmin";
import { ContentTab } from "@/components/sft/ContentTab";
import { RecipesTab } from "@/components/sft/RecipesTab";
import { CuisinesTab } from "@/components/sft/CuisinesTab";
import {
  Loader2,
  Plus,
  ArrowLeft,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
  FileText,
  Video,
  BookOpen,
  Layers,
} from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/sft-training/courses/$courseId",
)({
  component: CourseBuilder,
});

const TYPE_META: Record<ModuleType, { icon: typeof FileText; label: string }> =
  {
    slides: { icon: Layers, label: "Slides + Voiceover" },
    video: { icon: Video, label: "Video" },
    reading: { icon: BookOpen, label: "Reading" },
    mixed: { icon: FileText, label: "Mixed" },
  };

function CourseBuilder() {
  const { courseId } = Route.useParams();
  const qc = useQueryClient();
  const fnGet = getCourse;
  const fnUpd = updateCourse;
  const fnReorder = reorderModules;

  const q = useQuery({
    queryKey: ["lp-course", courseId],
    queryFn: () => fnGet({ course_id: courseId }),
  });

  const updMut = useMutation({
    mutationFn: fnUpd,
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["lp-course", courseId] });
      qc.invalidateQueries({ queryKey: ["lp-courses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMut = useMutation({
    mutationFn: fnReorder,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["lp-course", courseId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // local mirrors of editable fields
  const [meta, setMeta] = useState({
    title: "",
    summary: "",
    duration_label: "",
    pass_pct: 70,
    day5_gate_days: 5,
    requires_product_upload: true,
    requires_inspection: true,
    issues_certificate: true,
  });
  useEffect(() => {
    if (q.data) {
      const c = q.data.course;
      setMeta({
        title: c.title,
        summary: c.summary ?? "",
        duration_label: c.duration_label ?? "",
        pass_pct: c.pass_pct,
        day5_gate_days: c.day5_gate_days,
        requires_product_upload: c.requires_product_upload,
        requires_inspection: c.requires_inspection,
        issues_certificate: c.issues_certificate,
      });
    }
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }
  if (!q.data) return null;
  const { course, modules } = q.data;

  function move(idx: number, dir: -1 | 1) {
    const next = [...modules];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    reorderMut.mutate({ course_id: course.id, order: next.map((m) => m.id) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/sft-training/program">
            <ArrowLeft className="h-4 w-4" /> Back to program
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              to="/learn/$courseId"
              params={{ courseId: course.id }}
              target="_blank"
              rel="noreferrer"
            >
              Open partner view ↗
            </Link>
          </Button>
          <Badge variant={course.published ? "default" : "secondary"}>
            {course.published ? "Published" : "Draft"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="journey">Partner Journey</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="cuisines">Cuisines</TabsTrigger>
          <TabsTrigger value="certificate">Certificate</TabsTrigger>
          <TabsTrigger value="welcome">Welcome Letter</TabsTrigger>
          <TabsTrigger value="preview">Partner Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <ContentTab course={course} />
        </TabsContent>
        <TabsContent value="journey">
          <JourneyStepsTab course={course} />
        </TabsContent>
        <TabsContent value="downloads">
          <div className="space-y-6">
            <ResourcesPanel courseId={course.id} />
            <VideosPanel courseId={course.id} />
          </div>
        </TabsContent>
        <TabsContent value="recipes">
          <RecipesTab course={course} />
        </TabsContent>
        <TabsContent value="cuisines">
          <CuisinesTab course={course} />
        </TabsContent>
        <TabsContent value="certificate">
          <CertificateTab course={course} />
        </TabsContent>
        <TabsContent value="welcome">
          <WelcomeLetterTab course={course} />
        </TabsContent>
        <TabsContent value="preview">
          <PartnerPreviewTab courseId={course.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PartnerPreviewTab({ courseId }: { courseId: string }) {
  const src = `/learn/${courseId}`;
  const [key, setKey] = useState(0);
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Partner dashboard preview</CardTitle>
          <CardDescription>
            Live view of what an invited partner sees. After saving edits in
            other tabs, hit Refresh.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKey((k) => k + 1)}
          >
            Refresh
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={src} target="_blank" rel="noreferrer">
              Open in new tab ↗
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <iframe
            key={key}
            src={src}
            title="Partner dashboard preview"
            className="h-[70dvh] w-full"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function JourneyStepsTab({
  course,
}: {
  course: import("@/lib/learning/learning.functions").Course;
}) {
  const qc = useQueryClient();
  const fnUpd = updateCourse;
  const stepDefaults = [
    "Learn ({days} days)",
    "Cook the products",
    "Upload photos",
    "Physical visit & tasting",
    "Get certified",
  ];
  const sectionDefaults = [
    "journey",
    "upload",
    "downloads",
    "certificate",
    "modules",
  ];
  const SECTION_LABELS: Record<string, string> = {
    journey: "Journey chips (Learn / Cook / Upload …)",
    upload: "Product upload card",
    downloads: "Downloads & resources",
    certificate: "Completion certificate",
    modules: "Modules list",
  };

  const [steps, setSteps] = useState<string[]>(
    course.journey_steps && course.journey_steps.length
      ? course.journey_steps
      : stepDefaults,
  );
  const [sections, setSections] = useState<string[]>(
    course.section_order && course.section_order.length
      ? course.section_order
      : sectionDefaults,
  );

  const mut = useMutation({
    mutationFn: fnUpd,
    onSuccess: () => {
      toast.success("Layout saved");
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
      qc.invalidateQueries({ queryKey: ["lp-course-learner", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function moveStep(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  }
  function moveSection(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journey chips (top row)</CardTitle>
          <CardDescription>
            Edit, reorder, add or remove the chips that appear horizontally
            above the dashboard. Use{" "}
            <code className="rounded bg-muted px-1 text-[11px]">
              {"{days}"}
            </code>{" "}
            to insert the module count.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={i === 0}
                  onClick={() => moveStep(i, -1)}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={i === steps.length - 1}
                  onClick={() => moveStep(i, 1)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={s}
                maxLength={120}
                onChange={(e) => {
                  const next = [...steps];
                  next[i] = e.target.value;
                  setSteps(next);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={steps.length <= 1}
                onClick={() => setSteps(steps.filter((_, k) => k !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={steps.length >= 8}
            onClick={() => setSteps([...steps, "New step"])}
          >
            <Plus className="h-4 w-4" /> Add chip
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Section order (top → bottom)
          </CardTitle>
          <CardDescription>
            Reorder the cards/sections partners see on their dashboard. Sections
            that aren't enabled for this course (e.g. certificate) stay hidden
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {sections.map((key, i) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-md border border-border p-2"
            >
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={i === 0}
                  onClick={() => moveSection(i, -1)}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={i === sections.length - 1}
                  onClick={() => moveSection(i, 1)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <span className="flex-1 text-sm">
                {SECTION_LABELS[key] ?? key}
              </span>
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSteps(stepDefaults);
            setSections(sectionDefaults);
          }}
        >
          Reset to defaults
        </Button>
        <Button
          size="sm"
          disabled={mut.isPending}
          onClick={() =>
            mut.mutate({
              course_id: course.id,
              journey_steps: steps,
              section_order: sections as (
                "journey" | "upload" | "downloads" | "certificate" | "modules"
              )[],
            })
          }
        >
          {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" /> Save layout
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ModuleRow({
  module: m,
  supportedLanguages,
  first,
  last,
  onMove,
}: {
  module: CourseModule;
  supportedLanguages: string[];
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const qc = useQueryClient();
  const fnUpd = updateModule;
  const fnDel = deleteModule;
  const Icon = TYPE_META[m.type].icon;
  const delMut = useMutation({
    mutationFn: fnDel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lp-course"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const togglePub = useMutation({
    mutationFn: fnUpd,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lp-course"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={first}
          onClick={() => onMove(-1)}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={last}
          onClick={() => onMove(1)}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>
      <Icon className="h-4 w-4 text-accent" />
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{m.title}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{TYPE_META[m.type].label}</span>
          {m.est_minutes && <span>· {m.est_minutes} min</span>}
          {m.type === "slides" && !m.deck_id && (
            <Badge variant="destructive" className="text-[10px]">
              No deck
            </Badge>
          )}
        </div>
      </div>
      <Switch
        checked={m.published}
        onCheckedChange={(v) => togglePub.mutate({ id: m.id, published: v })}
      />
      <ModuleAdvancedDialog
        module={m}
        supportedLanguages={supportedLanguages}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (confirm(`Delete module "${m.title}"?`)) {
            delMut.mutate({ id: m.id });
          }
        }}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function AddModuleDialog({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ModuleType>("slides");
  const [videoUrl, setVideoUrl] = useState("");
  const [reading, setReading] = useState("");
  const [est, setEst] = useState(15);

  const createMut = useMutation({
    mutationFn: createModule,
    onSuccess: () => {
      toast.success("Module added");
      qc.invalidateQueries({ queryKey: ["lp-course", courseId] });
      setOpen(false);
      setTitle("");
      setVideoUrl("");
      setReading("");
      setEst(15);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    createMut.mutate({
      course_id: courseId,
      type,
      title,
      est_minutes: est,
      video_url: type === "video" ? videoUrl || undefined : undefined,
      reading_md:
        type === "reading" || type === "mixed"
          ? reading || undefined
          : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add module
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New module</DialogTitle>
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
          {type === "slides" && (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              Slides modules use the deck uploaded on the course card in Program
              & Courses. Upload or replace it there.
            </p>
          )}
          {type === "video" && (
            <div className="space-y-1">
              <Label className="text-xs">
                Video URL (YouTube, Vimeo, or MP4)
              </Label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </div>
          )}
          {(type === "reading" || type === "mixed") && (
            <div className="space-y-1">
              <Label className="text-xs">Reading content (markdown)</Label>
              <Textarea
                rows={5}
                value={reading}
                onChange={(e) => setReading(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!title || createMut.isPending} onClick={submit}>
            {createMut.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Create module
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
