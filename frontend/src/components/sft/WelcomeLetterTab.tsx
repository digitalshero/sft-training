import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateCourseConfig, type Course } from "@/lib/learning/learning.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Mail } from "lucide-react";

export function WelcomeLetterTab({ course }: { course: Course }) {
  const qc = useQueryClient();
  const fn = updateCourseConfig;
  const w = course.welcome_letter ?? {};
  const [welcome, setWelcome] = useState({
    subject: w.subject ?? "Welcome to the Shero Certified Partner training",
    body_md:
      w.body_md ??
      `Hi {{partner_name}},\n\nWelcome aboard! You've been invited to the **{{course_title}}** training.\n\nThis is a self-paced, 5-day course you can take from any laptop or desktop.\n\n• Each day has a short voiced slide deck + a quick quiz.\n• After Day 5 you'll cook the listed products and upload photos.\n• Once approved, your certificate is issued instantly.\n\nClick the button in the invite email to begin.\n\n— Team Shero`,
  });

  const save = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Welcome letter saved");
      qc.invalidateQueries({ queryKey: ["lp-course", course.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" /> Welcome letter (sent with the invite link)
        </CardTitle>
        <CardDescription>
          Tokens: <code>{"{{partner_name}}"}</code>, <code>{"{{course_title}}"}</code>,{" "}
          <code>{"{{invite_link}}"}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Subject</Label>
          <Input
            value={welcome.subject}
            onChange={(e) => setWelcome({ ...welcome, subject: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Body (markdown)</Label>
          <Textarea
            rows={12}
            value={welcome.body_md}
            onChange={(e) => setWelcome({ ...welcome, body_md: e.target.value })}
          />
        </div>
        <div className="flex justify-end">
          <Button
            disabled={save.isPending}
            onClick={() => save.mutate({ course_id: course.id, welcome_letter: welcome })}
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
