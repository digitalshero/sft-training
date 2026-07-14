// Partner card to upload Day-N product proof photos. Shows current
// submission status with feedback when reviewed.

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api/client";
import { uploadToStorage } from "@/lib/api/storage";
import {
  myProductSubmission,
  submitProductUpload,
  type Course,
} from "@/lib/learning/learning.functions";
import { formatDateTimeET } from "@/lib/datetime-et";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  UploadCloud,
  Loader2,
  CheckCircle2,
  RotateCw,
  XCircle,
  Clock,
} from "lucide-react";

interface Props {
  course: Course;
  allModulesComplete: boolean;
}

const STATUS_BADGE: Record<
  string,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  pending: {
    label: "In review",
    cls: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    Icon: Clock,
  },
  approved: {
    label: "Approved",
    cls: "bg-accent/10 text-accent border-accent/40",
    Icon: CheckCircle2,
  },
  redo: {
    label: "Needs redo",
    cls: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/40",
    Icon: RotateCw,
  },
  rejected: {
    label: "Rejected",
    cls: "bg-destructive/10 text-destructive border-destructive/40",
    Icon: XCircle,
  },
};

export function ProductUploadCard({ course, allModulesComplete }: Props) {
  const qc = useQueryClient();
  const fnMine = myProductSubmission;
  const fnSubmit = submitProductUpload;
  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [notes, setNotes] = useState("");

  const subQ = useQuery({
    queryKey: ["lp-product-sub", course.id],
    queryFn: () => fnMine({ courseId: course.id }),
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (picked.length === 0) throw new Error("Pick at least one photo");
      const uploaded: Array<{ path: string; label?: string }> = [];
      for (const f of picked) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `partner/${course.id}/${Date.now()}_${safe}`;
        const error = await uploadToStorage("sft-practice", path, f);
        if (error) throw new Error(error);
        uploaded.push({ path, label: f.name });
      }
      return fnSubmit({
        courseId: course.id,
        files: uploaded,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Product submitted for review");
      setPicked([]);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["lp-product-sub", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sub = subQ.data;
  const status = sub?.status;
  const canResubmit = !sub || status === "redo" || status === "rejected";
  const brief = course.product_brief ?? {};

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {brief.title || `Day ${course.day5_gate_days}+ product upload`}
            </CardTitle>
            <CardDescription>
              {brief.instructions ||
                "Cook the dish, take photos, and upload for trainer review."}
            </CardDescription>
          </div>
          {status && (
            <Badge variant="outline" className={STATUS_BADGE[status]?.cls}>
              {(() => {
                const meta = STATUS_BADGE[status];
                if (!meta) return status;
                const Icon = meta.Icon;
                return (
                  <>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </>
                );
              })()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!allModulesComplete && !sub && (
          <p className="text-xs text-muted-foreground">
            Complete all course modules first to unlock the product upload.
          </p>
        )}

        {sub && (
          <div className="rounded-md border border-border bg-muted/20 p-3 text-xs space-y-1">
            <div className="text-muted-foreground">
              Submitted {formatDateTimeET(sub.submitted_at)} ·{" "}
              {sub.files.length} file
              {sub.files.length === 1 ? "" : "s"}
            </div>
            {sub.notes && (
              <div>
                Your notes: <span className="text-foreground">{sub.notes}</span>
              </div>
            )}
            {sub.feedback && (
              <div className="border-l-2 border-accent pl-2 mt-1">
                <span className="font-medium">Trainer feedback:</span>{" "}
                {sub.feedback}
              </div>
            )}
          </div>
        )}

        {(brief.required_photos?.length ?? 0) > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Required photos:
            </span>{" "}
            {brief.required_photos!.join(", ")}
          </div>
        )}

        {canResubmit && allModulesComplete && (
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setPicked(Array.from(e.target.files ?? []))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <UploadCloud className="h-3 w-3" /> Choose photos
              </Button>
              {picked.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {picked.length} selected
                </span>
              )}
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for the trainer (optional)"
              rows={2}
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => submitMut.mutate()}
                disabled={submitMut.isPending || picked.length === 0}
              >
                {submitMut.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                Submit for review
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
