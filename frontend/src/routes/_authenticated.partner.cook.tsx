import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { uploadToStorage } from "@/lib/api/storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import api from "@/lib/api/client";
import { StageShell } from "@/components/partner/stage-shell";
import {
  CelebrationDialog,
  celebrationButtonClass,
} from "@/components/partner/celebration-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ChefHat,
  Loader2,
  Lock,
  UploadCloud,
  ImageIcon,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Camera,
  PartyPopper,
  ClipboardCheck,
  ChevronDown,
  Info,
  Trash2,
} from "lucide-react";
import { UploadPanel } from "@/components/partner/upload-panel";
import {
  getAssignedRecipe,
  getSampleImageGuide,
} from "@/lib/learning/recipes.functions";
import {
  listPartnerCuisines,
  getMyCookAssignments,
  chooseCuisine,
  removeCuisine,
  submitCookUploads,
  uploadCookDraft,
  submitCookDraft,
  removeCookDraftImage,
} from "@/lib/learning/cuisines.functions";
import type { Cuisine } from "@/lib/learning/cuisines.functions";
import { useClearNotificationsOnVisit } from "@/lib/partner/notifications.functions";

import type { Recipe } from "@/lib/learning/recipes.functions";

type ProductUpload = {
  path: string;
  url: string;
  decision: string | null;
  remark: string | null;
};

type DraftUpload = { path: string; url: string };

type PartnerAssignedRecipe = {
  assignment_id: string;
  recipe_id: string;
  cuisine_id: string;
  cuisine_name: string;
  food_name: string;
  status: string;
  admin_comment?: string | null;
  uploads: ProductUpload[];
  draft_status: "none" | "pending" | "submitted";
  draft_uploads: DraftUpload[];
  image_url?: string | null;
  ingredients_md: string;
  prep_steps_md: string | null;
  cook_steps_md: string | null;
};

// A product needs no further action from the partner right now once an admin
// has already approved it, it's sitting inside a submission awaiting admin
// review, or the partner has submitted their draft for it. "redo" always
// needs action, even if a prior round's draft was submitted — that's what
// reopens it for a fresh photo + resubmission.
function isProductResolved(a: PartnerAssignedRecipe): boolean {
  if (a.status === "redo") return false;
  if (a.status === "approved" || a.status === "pending") return true;
  return a.draft_status === "submitted";
}

function CookHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-white/40 bg-linear-to-br from-success/10 via-white/60 to-transparent p-6 md:p-8 shadow-lg backdrop-blur-xl transition-shadow hover:shadow-2xl"
    >
      <motion.div
        className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-success/20 blur-2xl"
        animate={{ x: [0, 15, 0], y: [0, 10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative z-10 w-full sm:max-w-[65%]">
        <span className="inline-flex items-center rounded-full bg-success/20 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-success shadow-sm">
          Step 2 of 5
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Prepare &amp; Cook
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Pick a cuisine, cook each product, then upload photos for review.
        </p>
      </div>
      <div className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 sm:block md:right-8">
        <motion.div
          className="grid h-32 w-32 place-items-center rounded-full bg-success/15 md:h-40 md:w-40 shadow-inner"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChefHat className="h-14 w-14 text-success/60 md:h-16 md:w-16 drop-shadow-md" />
        </motion.div>
      </div>
    </motion.div>
  );
}

export const Route = createFileRoute("/_authenticated/partner/cook")({
  component: () => (
    <StageShell
      stage="cook"
      title="Prepare & Cook"
      subtitle="Pick a cuisine, cook each product, then upload photos for review."
      heroSlot={<CookHero />}
    >
      {({ invite, data }) => {
        const prog = data.progress[invite.course_id];
        const allDone =
          !!prog &&
          prog.modules_total > 0 &&
          prog.modules_done === prog.modules_total;
        const isCertified = data.certificates.some(
          (c) => c.course_id === invite.course_id,
        );
        return (
          <CookView
            courseId={invite.course_id}
            allDone={allDone}
            isCertified={isCertified}
          />
        );
      }}
    </StageShell>
  ),
});

function CookView({
  courseId,
  allDone,
  isCertified,
}: {
  courseId: string;
  allDone: boolean;
  isCertified: boolean;
}) {
  // Clear any Prepare & Cook notifications as soon as the partner visits this
  // page — they're seeing/handling the underlying comment right here, so it
  // shouldn't keep sitting as an unread badge just because they never opened
  // the bell panel.
  useClearNotificationsOnVisit("prepare_cook");

  // First try the new cuisine-based flow
  const fnCuisines = listPartnerCuisines;
  const cuisinesQ = useQuery({
    queryKey: ["lp-partner-cuisines", courseId],
    queryFn: () => fnCuisines({ course_id: courseId }),
    enabled: allDone,
  });

  if (!allDone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" /> Complete your training first
          </CardTitle>
          <CardDescription>
            Finish all 5 learning days and the final quiz. The cook stage will
            unlock automatically.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (cuisinesQ.isLoading)
    return <Loader2 className="h-5 w-5 animate-spin text-accent" />;

  const cuisines = cuisinesQ.data?.cuisines ?? [];
  if (cuisines.length === 0) {
    // Fall back to the legacy single-recipe assignment flow
    return <LegacyCookView courseId={courseId} allDone={allDone} />;
  }

  return <CuisineCookView courseId={courseId} isCertified={isCertified} />;
}

function CuisineCookView({
  courseId,
  isCertified,
}: {
  courseId: string;
  isCertified: boolean;
}) {
  const qc = useQueryClient();
  const fnAssignments = getMyCookAssignments;
  const fnCuisines = listPartnerCuisines;
  const fnChoose = chooseCuisine;
  const fnRemove = removeCuisine;

  const assignQ = useQuery<PartnerAssignedRecipe[]>({
    queryKey: ["lp-cook-assignments", courseId],
    queryFn: () => fnAssignments({ course_id: courseId }),
  });
  const cuisinesQ = useQuery({
    queryKey: ["lp-partner-cuisines", courseId],
    queryFn: () => fnCuisines({ course_id: courseId }),
  });

  const choose = useMutation({
    mutationFn: (cuisineId: string) =>
      fnChoose({ course_id: courseId, cuisineId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lp-cook-assignments", courseId] });
      toast.success("Cuisine selected — your products are ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (cuisineId: string) =>
      fnRemove({ course_id: courseId, cuisineId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lp-cook-assignments", courseId] });
      toast.success("Cuisine removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (assignQ.isLoading || cuisinesQ.isLoading)
    return <Loader2 className="h-5 w-5 animate-spin text-accent" />;

  const assignments = assignQ.data ?? [];
  const cuisines = cuisinesQ.data?.cuisines ?? [];
  const maxCuisines = cuisinesQ.data?.max_cuisines ?? null;
  const chosenCuisineIds = new Set(assignments.map((a) => a.cuisine_id));
  const atLimit = maxCuisines != null && chosenCuisineIds.size >= maxCuisines;
  const canRemove =
    !isCertified &&
    assignments.every(
      (a) => a.status === "not_uploaded" && a.draft_status === "none",
    );

  return (
    <div className="space-y-5">
      <CuisinePicker
        cuisines={cuisines}
        chosenCuisineIds={chosenCuisineIds}
        maxCuisines={maxCuisines}
        atLimit={atLimit}
        canRemove={canRemove}
        pending={choose.isPending || remove.isPending || isCertified}
        onChoose={(id) => choose.mutate(id)}
        onRemove={(id) => remove.mutate(id)}
      />
      {assignments.length > 0 && (
        <ProductChecklist
          courseId={courseId}
          assignments={assignments}
          locked={isCertified}
        />
      )}
    </div>
  );
}

const CUISINE_TINTS = [
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
  "bg-sky-50 text-sky-600",
  "bg-rose-50 text-rose-600",
  "bg-violet-50 text-violet-600",
];

function StepHeading({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success text-sm font-bold text-white">
        {step}
      </div>
      <div>
        <div className="text-base font-semibold">{title}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function CuisinePicker({
  cuisines,
  chosenCuisineIds,
  maxCuisines,
  atLimit,
  canRemove,
  pending,
  onChoose,
  onRemove,
}: {
  cuisines: Cuisine[];
  chosenCuisineIds: Set<string>;
  maxCuisines: number | null;
  atLimit: boolean;
  canRemove: boolean;
  pending: boolean;
  onChoose: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const description =
    maxCuisines === 1
      ? "Choose the cuisine you will be cooking for this course."
      : maxCuisines != null
        ? `Choose up to ${maxCuisines} cuisines you will be cooking for this course.`
        : "Choose the cuisine(s) you will be cooking for this course.";

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <StepHeading step={1} title="Select Cuisine" description={description} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {cuisines.map((c, i) => {
            const chosen = chosenCuisineIds.has(c.id);
            const disabled = !chosen && (atLimit || c.recipe_count === 0 || pending);
            const tint = CUISINE_TINTS[i % CUISINE_TINTS.length];

            return (
              <motion.button
                key={c.id}
                disabled={disabled}
                whileHover={!disabled && !chosen ? { y: -4, scale: 1.03 } : {}}
                whileTap={!disabled ? { scale: 0.96 } : {}}
                onClick={() => (chosen ? undefined : onChoose(c.id))}
                className={`group relative rounded-2xl border p-4 text-center transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  chosen
                    ? "border-success bg-success/5 shadow-md ring-1 ring-success/30"
                    : "border-white/40 bg-white/60 hover:border-primary/30 hover:bg-white hover:shadow-lg backdrop-blur-md"
                }`}
              >
                {chosen && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-success text-white shadow-sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </motion.div>
                )}
                <div
                  className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${tint}`}
                >
                  <ChefHat className="h-6 w-6" />
                </div>
                <div className="mt-3 text-sm font-semibold">{c.name}</div>
                {chosen && canRemove && (
                  <button
                    disabled={pending}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(c.id);
                    }}
                    className="mt-1.5 text-[0.7rem] font-medium text-destructive hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </motion.button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ item }: { item: PartnerAssignedRecipe }) {
  if (item.status === "approved")
    return (
      <Badge className="gap-1 bg-success/15 text-success border-success/30">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </Badge>
    );
  if (item.status === "redo")
    return (
      <Badge variant="destructive" className="gap-1">
        <RotateCcw className="h-3 w-3" /> Redo Required
      </Badge>
    );
  if (item.status === "pending")
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3" /> Pending review
      </Badge>
    );
  // Product-level submit already clicked, waiting on Final Submit — distinct
  // from an admin-side "Pending review" (that only starts after Final Submit).
  if (item.draft_status === "submitted")
    return (
      <Badge className="gap-1 bg-success/15 text-success border-success/30">
        <CheckCircle2 className="h-3 w-3" /> Submitted
      </Badge>
    );
  if (item.draft_uploads.length > 0)
    return (
      <Badge className="gap-1 bg-success/15 text-success border-success/30">
        <CheckCircle2 className="h-3 w-3" /> Uploaded
      </Badge>
    );
  return <Badge variant="outline">Pending</Badge>;
}

function ProductChecklist({
  courseId,
  assignments,
  locked = false,
}: {
  courseId: string;
  assignments: PartnerAssignedRecipe[];
  locked?: boolean;
}) {
  const qc = useQueryClient();
  const multiCuisine = new Set(assignments.map((a) => a.cuisine_name)).size > 1;

  const [guideOpen, setGuideOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState<PartnerAssignedRecipe | null>(
    null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);

  // Clicking a product card sets activeId — scroll its upload section into
  // view and briefly highlight it so the partner can see where they landed.
  useEffect(() => {
    if (!activeId) return;
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightId(activeId);
    const t = setTimeout(() => {
      setHighlightId((h) => (h === activeId ? null : h));
    }, 1500);
    return () => clearTimeout(t);
  }, [activeId]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["lp-cook-assignments", courseId] });

  // Products still needing the partner's attention right now.
  const actionable = assignments.filter((a) => !isProductResolved(a));
  const active =
    assignments.find((a) => a.recipe_id === activeId) ??
    actionable[0] ??
    assignments[0] ??
    null;

  const uploadDraftM = useMutation({
    mutationFn: (vars: { assignmentId: string; path: string }) =>
      uploadCookDraft({ course_id: courseId, ...vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeImageM = useMutation({
    mutationFn: (vars: { assignmentId: string; path: string }) =>
      removeCookDraftImage({ course_id: courseId, ...vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const submitDraftM = useMutation({
    mutationFn: (assignmentId: string) =>
      submitCookDraft({ course_id: courseId, assignmentId }),
    onSuccess: (_data, assignmentId) => {
      toast.success("Product submitted");
      invalidate();
      const submitted = assignments.find((a) => a.assignment_id === assignmentId);
      const nextUp = actionable.find((a) => a.assignment_id !== assignmentId);
      if (nextUp) {
        setActiveId(nextUp.recipe_id);
        if (submitted) {
          toast.message(`Now upload ${nextUp.food_name}.`);
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalSubmitM = useMutation({
    mutationFn: () => {
      const files = assignments
        .filter((a) => a.status !== "approved")
        .flatMap((a) =>
          (a.draft_uploads.length ? a.draft_uploads : a.uploads).map((u) => ({
            path: u.path,
            label: `${a.cuisine_name} — ${a.food_name}`,
          })),
        );
      return submitCookUploads({ course_id: courseId, files });
    },
    onSuccess: () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0D9488', '#10B981', '#F59E0B'],
        zIndex: 100,
      });
      toast.success("Submitted for review");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolvedCount = assignments.filter(isProductResolved).length;
  const allApproved =
    assignments.length > 0 &&
    assignments.every((a) => a.status === "approved");
  const readyForFinalSubmit =
    assignments.length > 0 && resolvedCount === assignments.length;

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <StepHeading
              step={2}
              title="Products to Cook"
              description="Cook each product from the selected cuisine."
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGuideOpen(true)}
            >
              <Camera className="h-3.5 w-3.5" /> View Sample Image Guide
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {assignments.map((a) => {
            const isActive = a.recipe_id === active?.recipe_id;
            const thumb =
              a.draft_uploads[0]?.url ??
              a.uploads[0]?.url ??
              a.image_url ??
              null;
            return (
              <Fragment key={a.recipe_id}>
                <button
                  onClick={() => setActiveId(a.recipe_id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    isActive
                      ? "border-success/50 bg-success/5"
                      : "border-border bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ChefHat className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {a.food_name}
                    </div>
                    {multiCuisine && (
                      <span className="mt-0.5 inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[0.65rem] font-medium text-success">
                        {a.cuisine_name}
                      </span>
                    )}
                  </div>
                  <StatusBadge item={a} />
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      isActive ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      id={`upload-section-${a.recipe_id}`}
                      ref={uploadSectionRef}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`overflow-hidden rounded-2xl transition-shadow duration-500 ${
                        highlightId === a.recipe_id
                          ? "ring-2 ring-success ring-offset-4 ring-offset-background"
                          : ""
                      }`}
                    >
                      <UploadZone
                        active={a}
                        uploading={
                          uploadDraftM.isPending &&
                          uploadDraftM.variables?.assignmentId === a.assignment_id
                        }
                        submitting={
                          submitDraftM.isPending &&
                          submitDraftM.variables === a.assignment_id
                        }
                        removing={
                          removeImageM.isPending &&
                          removeImageM.variables?.assignmentId === a.assignment_id
                        }
                        onUpload={(path) =>
                          uploadDraftM.mutate({ assignmentId: a.assignment_id, path })
                        }
                        onRemoveImage={(path) =>
                          removeImageM.mutate({ assignmentId: a.assignment_id, path })
                        }
                        onSubmit={() => submitDraftM.mutate(a.assignment_id)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Fragment>
            );
          })}
          {assignments.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No products assigned yet.
            </div>
          )}
        </CardContent>
      </Card>

      {!locked && !allApproved && assignments.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="text-sm text-muted-foreground">
              {resolvedCount} / {assignments.length} Completed
            </div>
            <Button
              disabled={!readyForFinalSubmit || finalSubmitM.isPending}
              onClick={() => finalSubmitM.mutate()}
            >
              {finalSubmitM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              Final Submit
            </Button>
          </CardContent>
        </Card>
      )}

      <SampleGuideDialog
        courseId={courseId}
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />
      <RecipeDialog recipe={recipeOpen} onClose={() => setRecipeOpen(null)} />
      <ApprovedDialog open={allApproved} />
    </div>
  );
}

// ── Client-side image quality check (blur + brightness) ──────────────────────
async function checkImageQuality(
  file: File,
): Promise<{ valid: boolean; reason: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const SIZE = 200;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        const gray: number[] = [];
        let brightness = 0;
        for (let i = 0; i < data.length; i += 4) {
          const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray.push(g);
          brightness += g;
        }
        brightness /= gray.length;

        if (brightness < 25) {
          resolve({ valid: false, reason: "Photo is too dark. Move to a well-lit area and try again." });
          return;
        }
        if (brightness > 245) {
          resolve({ valid: false, reason: "Photo is overexposed. Avoid direct flash or harsh light directly above the dish." });
          return;
        }

        // Laplacian variance — measures sharpness
        let lapSum = 0;
        let count = 0;
        for (let y = 1; y < SIZE - 1; y++) {
          for (let x = 1; x < SIZE - 1; x++) {
            const idx = y * SIZE + x;
            const lap = Math.abs(
              -4 * gray[idx] + gray[idx - 1] + gray[idx + 1] + gray[idx - SIZE] + gray[idx + SIZE],
            );
            lapSum += lap;
            count++;
          }
        }
        const sharpness = lapSum / count;
        if (sharpness < 6) {
          resolve({ valid: false, reason: "Photo is blurry. Hold your phone steady and make sure the dish is in focus." });
          return;
        }

        resolve({ valid: true, reason: "" });
      } catch {
        resolve({ valid: true, reason: "" }); // Canvas error — don't block
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ valid: false, reason: "Could not read the image file." });
    };
    img.src = url;
  });
}

function UploadZone({
  active,
  uploading: persisting,
  submitting,
  removing,
  onUpload,
  onRemoveImage,
  onSubmit,
}: {
  active: PartnerAssignedRecipe;
  uploading: boolean;
  submitting: boolean;
  removing: boolean;
  onUpload: (path: string) => void;
  onRemoveImage: (path: string) => void;
  onSubmit: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);

  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
  const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"];
  const MAX_SIZE_MB = 10;

  async function pick(file: File) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();

    if (
      !ALLOWED_TYPES.includes(file.type) ||
      !ALLOWED_EXTENSIONS.includes(ext)
    ) {
      toast.error(
        "Only JPG or PNG images are allowed. PDF and other file types are not accepted for product photos.",
      );
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Image is too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }

    // Step 1: client-side blur + brightness check
    const quality = await checkImageQuality(file);
    if (!quality.valid) {
      toast.error(quality.reason, { duration: 6000 });
      return;
    }

    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      const path = `partner/${crypto.randomUUID()}.${ext}`;
      const uploadErr = await uploadToStorage("sft-practice", path, file);
      if (uploadErr) throw uploadErr;
      uploadedPath = path;

      // Step 2: backend AI angle + quality check
      setUploading(false);
      setValidating(true);
      let aiValid = true;
      let aiReason = "";
      try {
        const aiRes = await api.post("/partner/validate-cook-photo", { path });
        aiValid = aiRes.data?.valid !== false;
        aiReason = aiRes.data?.reason ?? "";
      } catch {
        // AI check unavailable — allow upload
      }

      if (!aiValid) {
        toast.error(aiReason || "Photo does not meet requirements. Please retake.", { duration: 7000 });
        return; // uploaded file stays in storage but is never committed — cleaned up by maintenance
      }

      onUpload(path);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      setValidating(false);
      void uploadedPath; // used above
    }
  }

  const locked = isProductResolved(active);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <StepHeading
          step={3}
          title={`Upload Photos — ${active.food_name}`}
          description={`Upload one or more clear images of your prepared ${active.food_name} for review.`}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {active.admin_comment && (
          <div
            className={`flex gap-2 rounded-md border p-2 text-xs ${
              active.status === "redo"
                ? "border-destructive/30 bg-destructive/5"
                : "border-success/30 bg-success/5"
            }`}
          >
            <AlertCircle
              className={`h-3.5 w-3.5 shrink-0 ${
                active.status === "redo" ? "text-destructive" : "text-success"
              }`}
            />
            <div>
              <b>{active.status === "redo" ? "Redo:" : "Trainer feedback:"}</b>{" "}
              {active.admin_comment}
            </div>
          </div>
        )}

        {locked ? (
          <>
            {(active.draft_uploads.length > 0
              ? active.draft_uploads
              : active.uploads
            ).length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(active.draft_uploads.length > 0
                  ? active.draft_uploads
                  : active.uploads
                ).map((u) => (
                  <div
                    key={u.path}
                    className="aspect-4/3 overflow-hidden rounded-xl border border-border"
                  >
                    <img
                      src={u.url}
                      alt={active.food_name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="grid place-items-center rounded-xl border border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              {active.status === "approved"
                ? "Approved — no changes needed."
                : active.status === "pending"
                  ? "Submitted — awaiting review."
                  : "Submitted — click Final Submit below once every product is ready."}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {active.draft_uploads.map((u) => (
                <div
                  key={u.path}
                  className="relative aspect-4/3 overflow-hidden rounded-xl border border-border"
                >
                  <img
                    src={u.url}
                    alt={active.food_name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() => onRemoveImage(u.path)}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-destructive hover:bg-background disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <label
                className={`grid aspect-4/3 cursor-pointer place-items-center rounded-xl border border-dashed border-success/40 bg-success/5 text-center transition hover:bg-success/10 ${
                  uploading || validating || persisting
                    ? "pointer-events-none opacity-60"
                    : ""
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading || validating || persisting}
                  onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
                />
                {uploading || validating || persisting ? (
                  <Loader2 className="h-6 w-6 animate-spin text-success" />
                ) : (
                  <>
                    <UploadCloud className="h-6 w-6 text-success" />
                    <span className="mt-1 text-xs font-semibold text-success">
                      {active.draft_uploads.length ? "Add another" : "Choose image"}
                    </span>
                  </>
                )}
              </label>
            </div>
            {validating && (
              <p className="text-center text-xs text-success">
                Checking image clarity &amp; format…
              </p>
            )}
            <p className="text-center text-xs text-muted-foreground">
              JPG, PNG up to {MAX_SIZE_MB}MB each — upload as many as you need.
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-success/5 p-2.5 text-xs text-success">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Make sure each image is clear and well-lit for faster approval.
            </div>
            <Button
              className="w-full"
              disabled={active.draft_uploads.length === 0 || submitting}
              onClick={onSubmit}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              Submit {active.food_name}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecipeDialog({
  recipe,
  onClose,
}: {
  recipe: PartnerAssignedRecipe | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!recipe}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-primary" /> {recipe?.food_name}
          </DialogTitle>
        </DialogHeader>
        {recipe && (
          <div className="space-y-3">
            {recipe.image_url && (
              <img
                src={recipe.image_url}
                className="aspect-video w-full rounded-md border object-cover"
                alt=""
              />
            )}
            <Section title="Ingredients" md={recipe.ingredients_md} />
            {recipe.prep_steps_md && (
              <Section title="Preparation" md={recipe.prep_steps_md} />
            )}
            {recipe.cook_steps_md && (
              <Section title="Cooking Instructions" md={recipe.cook_steps_md} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, md }: { title: string; md: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="prose prose-sm max-w-none rounded-md border border-border bg-muted/30 p-3">
        <pre className="whitespace-pre-wrap font-sans text-sm">{md || "—"}</pre>
      </div>
    </div>
  );
}

function SampleGuideDialog({
  courseId,
  open,
  onClose,
}: {
  courseId: string;
  open: boolean;
  onClose: () => void;
}) {
  const fn = getSampleImageGuide;
  const q = useQuery({
    queryKey: ["lp-sample-guide", courseId],
    queryFn: () => fn({ course_id: courseId }),
    enabled: open,
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" /> Sample Food Image Guide
          </DialogTitle>
          <DialogDescription>
            How to capture great product photos.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {q.data && (
          <div className="space-y-3">
            <div className="grid h-36 w-40 place-items-center overflow-hidden rounded-md border bg-muted">
              {q.data.sample_image_url ? (
                <img
                  src={q.data.sample_image_url}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {q.data.guidelines_md}
              </pre>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onClose}>Proceed to Upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovedDialog({ open }: { open: boolean }) {
  const navigate = useNavigate();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open && !shown && typeof window !== "undefined") {
      const key = "cook-approved-celebrated";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        setShown(true);
      }
    }
  }, [open, shown]);
  return (
    <CelebrationDialog
      open={shown}
      onOpenChange={(o) => {
        if (!o) setShown(false);
      }}
      icon={PartyPopper}
      title="Congratulations!"
      description="You have successfully completed your cooking assessment."
      body="Would you like to select another cuisine, or proceed to your Physical Visit?"
      footer={
        <>
          <Button
            variant="outline"
            className={celebrationButtonClass}
            onClick={() => setShown(false)}
          >
            Yes — Select Another Cuisine
          </Button>
          <Button
            className={celebrationButtonClass}
            onClick={() => {
              setShown(false);
              navigate({ to: "/partner/visit" });
            }}
          >
            No — Physical Visit
          </Button>
        </>
      }
    />
  );
}

// ----- legacy single-recipe flow (kept for courses without cuisines) -----
function LegacyCookView({
  courseId,
  allDone,
}: {
  courseId: string;
  allDone: boolean;
}) {
  const fn = getAssignedRecipe;
  const q = useQuery({
    queryKey: ["lp-assigned-recipe", courseId],
    queryFn: () => fn({ course_id: courseId }),
    enabled: allDone,
  });

  if (q.isLoading)
    return <Loader2 className="h-5 w-5 animate-spin text-accent" />;
  if (!q.data || q.data.status !== "assigned") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ChefHat className="h-4 w-4" /> Waiting for assignment
          </CardTitle>
          <CardDescription>
            Your trainer will assign your recipe soon. Check back shortly.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const recipe = q.data.recipe;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ChefHat className="h-4 w-4" /> Your assigned recipe
          </CardTitle>
          <CardDescription>
            Cook this dish, then upload your prepared-food photos below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {recipe.image_url ? (
              <img
                src={recipe.image_url}
                alt={recipe.food_name}
                className="aspect-video w-full rounded-md border object-cover sm:w-56"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-md border bg-muted text-muted-foreground sm:w-56">
                <ChefHat className="h-8 w-8" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="text-lg font-semibold">{recipe.food_name}</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <UploadPanel courseId={courseId} allModulesComplete={allDone} />
    </div>
  );
}
