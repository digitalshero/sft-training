import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAllCourses } from "@/lib/learning/learning.functions";
import { ReviewQueue } from "@/components/sft/ReviewQueue";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/sft-training/review")({
  component: SftReviewPage,
});

function SftReviewPage() {
  const fnCourses = listAllCourses;
  const coursesQ = useQuery({
    queryKey: ["lp-all-courses"],
    queryFn: () => fnCourses(),
  });
  const [courseId, setCourseId] = useState<string>("");
  const selected = courseId || coursesQ.data?.[0]?.id || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            SFT Review
          </h2>
          <p className="text-sm text-muted-foreground">
            Executive review of partner product submissions for this course.
          </p>
        </div>
        <div className="w-full space-y-1 sm:w-auto sm:min-w-65">
          <Label className="text-xs">Course</Label>
          <Select value={selected} onValueChange={setCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a course" />
            </SelectTrigger>
            <SelectContent>
              {(coursesQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}{" "}
                  {!c.published && (
                    <span className="text-muted-foreground">(draft)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected ? (
        <ReviewQueue courseId={selected} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Pick a course to review submissions.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
