import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCourseTeachData } from "@/lib/learning/learning.functions";
import { parsePptx, type ParsedSlide } from "@/lib/sft-training/pptx-parser";
import { TeachConsole } from "@/components/sft/TeachConsole";

export const Route = createFileRoute(
  "/_authenticated/sft-training/teach/$courseId",
)({
  component: TeachPage,
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function TeachPage() {
  const { courseId } = Route.useParams();
  const validId = UUID_RE.test(courseId);
  const fn = getCourseTeachData;
  const q = useQuery({
    queryKey: ["teach-data", courseId],
    queryFn: () => fn({ course_id: courseId }),
    enabled: validId,
  });

  const [slides, setSlides] = useState<ParsedSlide[] | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!q.data?.deckUrl || !q.data?.pdfUrl) return;
      setSlides(null);
      setParseErr(null);
      try {
        const res = await fetch(q.data.deckUrl);
        if (!res.ok) throw new Error(`Deck download failed (${res.status})`);
        const buf = await res.arrayBuffer();
        const parsed = await parsePptx(buf);
        if (!cancelled) setSlides(parsed);
      } catch (e) {
        if (!cancelled) setParseErr((e as Error).message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [q.data?.deckUrl, q.data?.pdfUrl, setSlides, setParseErr]);

  if (!validId) {
    return (
      <Centered>
        <Card className="p-8 text-center text-sm text-muted-foreground space-y-3">
          <p>
            No course selected. Open a course from the program list to teach it.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/sft-training/program">
              <ArrowLeft className="h-4 w-4" /> Back to program
            </Link>
          </Button>
        </Card>
      </Centered>
    );
  }

  if (q.isLoading) {
    return (
      <Centered>
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </Centered>
    );
  }
  if (q.error) {
    return (
      <Centered>
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      </Centered>
    );
  }
  const data = q.data!;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Teach live
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {data.course.title}
          </h1>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/sft-training/program">
            <ArrowLeft className="h-4 w-4" /> Back to program
          </Link>
        </Button>
      </div>

      {!data.module ? (
        <Empty msg="No slides module configured for this course yet. Open the course builder and add a slide module." />
      ) : !data.deck || !data.deckUrl ? (
        <Empty msg="No slide deck uploaded for this course yet. Upload a PPTX from the course card." />
      ) : !data.pdfUrl ? (
        <Empty msg="This course is still using the old PPTX-only deck. Replace it with both the slide PDF and matching speaker-notes PPTX to show the exact slide content." />
      ) : slides === null && !parseErr ? (
        <Centered>
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </Centered>
      ) : parseErr ? (
        <Empty msg={`Failed to parse deck: ${parseErr}`} />
      ) : (
        <TeachConsole
          slides={slides!}
          module={data.module}
          deckName={data.deck.name}
          pdfUrl={data.pdfUrl}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12 flex items-center justify-center">
      {children}
    </div>
  );
}
function Empty({ msg }: { msg: string }) {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">{msg}</Card>
  );
}
