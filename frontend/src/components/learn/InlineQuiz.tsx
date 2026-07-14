// Quiz block. Auto-grades on submit, unlimited retries.
// On pass calls onPassed (marks the module complete server-side).
// On fail offers retry + an optional "Review previous lesson" link.
//
// Taking the quiz happens in a full-screen overlay with three screens:
// intro ("Ready for a quiz?") -> one question per screen -> results
// (pass -> Continue, fail -> Retry Quiz / Revise Module). Revisiting an
// already-passed module reopens this same overlay (a fresh attempt) instead
// of a separate read-only summary, so the experience stays consistent
// whether it's the first pass or a later review.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  RotateCw,
  Loader2,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  ClipboardCheck,
  Clock,
  Target,
  Trophy,
  ShieldCheck,
  Bookmark,
  PartyPopper,
  Frown,
  ChevronDown,
} from "lucide-react";
import {
  getNextQuizQuestions,
  recordModuleQuizAttempt,
  type QuizQuestion,
} from "@/lib/learning/learning.functions";

interface Props {
  questions: QuizQuestion[];
  passPct: number;
  isPassing?: boolean;
  onPassed: (scorePct: number) => void;
  onFailedAttempt?: (scorePct: number) => void;
  revisedContent?: string;
  moduleId?: string;
  /** "end_of_day" gets a "Final Challenge" framing on the intro screen. */
  quizPlacement?: string;
  /** Edge-triggered: when this flips from false/undefined to true, the quiz
   *  jumps straight to the intro screen instead of waiting for a manual
   *  "Take Quiz" click. */
  autoOpen?: boolean;
  /** If provided, called instead of closing the overlay when "Continue" is
   *  tapped on a passed results screen — lets the parent drive navigation. */
  onContinuePassed?: () => void;
}

type Screen = "trigger" | "intro" | "question" | "results";

export function InlineQuiz({
  questions: initialQuestions,
  passPct,
  isPassing,
  onPassed,
  onFailedAttempt,
  revisedContent,
  moduleId,
  quizPlacement,
  autoOpen,
  onContinuePassed,
}: Props) {
  const fetchNext = getNextQuizQuestions;
  const recordAttempt = recordModuleQuizAttempt;
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    () => initialQuestions,
  );
  const [attemptNo, setAttemptNo] = useState<number>(1);
  const [placement, setPlacement] = useState<string>(quizPlacement ?? "topic");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [screen, setScreen] = useState<Screen>("trigger");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [localPassPct, setLocalPassPct] = useState<number>(passPct);
  const [score, setScore] = useState(0);

  const passed = score >= localPassPct;
  const currentQ = questions[currentIdx];

  // Always jump straight into the quiz on arrival — no manual "Take Quiz"
  // trigger card. But if the learner explicitly backs out (Back / Review the
  // previous module), don't immediately relaunch just because `screen` is
  // back to "trigger" — let them actually land on the underlying module page
  // (with its real Previous/Next nav) instead of looping them straight back
  // into the quiz.
  const userExitedRef = useRef(false);
  useEffect(() => {
    if (autoOpen && screen === "trigger" && !userExitedRef.current) {
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, screen]);

  async function loadNextSet() {
    if (!moduleId) return;
    try {
      const res = await fetchNext({ moduleId });
      if (res.questions.length > 0) {
        setQuestions(res.questions);
        setAttemptNo(res.attemptNo);
        setPlacement(res.placement);
        if (res.passPct != null) setLocalPassPct(res.passPct);
      }
    } catch (e) {
      console.error("getNextQuizQuestions failed", e);
    }
  }

  async function start() {
    setAnswers({});
    setBookmarked(new Set());
    setCurrentIdx(0);
    if (moduleId) await loadNextSet();
    setScreen("intro");
  }

  async function submit(finalAnswers: Record<string, number>) {
    const correct = questions.filter(
      (q) => finalAnswers[q.id] === q.correct_index,
    ).length;
    const pct = Math.round((correct / questions.length) * 100);
    const didPass = pct >= localPassPct;
    setScore(pct);
    setScreen("results");
    if (moduleId) {
      // Wait for the backend to actually persist completedAt before
      // triggering onPassed's query invalidation — otherwise the progress
      // refetch can race ahead of this write and cache a stale, undercounted
      // module list (e.g. a day showing 3/4 done when all 4 are complete).
      try {
        await recordAttempt({
          moduleId,
          attemptNo,
          questionIds: questions.map((q) => q.id),
          answers: finalAnswers,
          scorePct: pct,
          passed: didPass,
          placement,
        });
      } catch (e) {
        console.error("recordModuleQuizAttempt failed", e);
      }
    }
    if (didPass) onPassed(pct);
    else onFailedAttempt?.(pct);
  }

  function selectAnswer(choiceIdx: number) {
    setAnswers((a) => ({ ...a, [currentQ.id]: choiceIdx }));
  }

  function goNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      void submit(answers);
    }
  }

  function goPrev() {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  }

  function toggleBookmark(id: string) {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeOverlay() {
    userExitedRef.current = true;
    setScreen("trigger");
  }

  if (questions.length === 0) return null;

  // While screen is still "trigger" but we're about to auto-launch, show the
  // fullscreen overlay immediately (with its own spinner) rather than waiting
  // for the question fetch to resolve first — otherwise the underlying module
  // page (Reading card, Previous/Next bar) is visible for that entire gap.
  const launching = screen === "trigger" && autoOpen && !userExitedRef.current;

  return (
    <>
      {(screen !== "trigger" || launching) && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
          {screen === "trigger" && (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing your quiz…
            </div>
          )}

          {screen === "intro" && (
            <QuizIntroScreen
              questionCount={questions.length}
              passPct={localPassPct}
              placement={placement}
              onBack={closeOverlay}
              onReviewModule={closeOverlay}
              onStart={() => setScreen("question")}
            />
          )}

          {screen === "question" && currentQ && (
            <QuizQuestionScreen
              question={currentQ}
              index={currentIdx}
              total={questions.length}
              selected={answers[currentQ.id]}
              bookmarked={bookmarked.has(currentQ.id)}
              onSelect={selectAnswer}
              onToggleBookmark={() => toggleBookmark(currentQ.id)}
              onBack={closeOverlay}
              onPrev={goPrev}
              onNext={goNext}
            />
          )}

          {screen === "results" && (
            <QuizResultsScreen
              score={score}
              passPct={localPassPct}
              passed={passed}
              questions={questions}
              answers={answers}
              revisedContent={!passed ? revisedContent : undefined}
              isPassing={isPassing}
              onContinue={() => {
                closeOverlay();
                onContinuePassed?.();
              }}
              onRetry={start}
            />
          )}
        </div>
      )}
    </>
  );
}

// ── Screen 1: Intro ("Ready for a quiz?") ──────────────────────────────────

function QuizIntroScreen({
  questionCount,
  passPct,
  placement,
  onBack,
  onReviewModule,
  onStart,
}: {
  questionCount: number;
  passPct: number;
  placement: string;
  onBack: () => void;
  onReviewModule: () => void;
  onStart: () => void;
}) {
  const title =
    placement === "end_of_day"
      ? "Ready for Today's Final Challenge?"
      : "Ready for a Quick Quiz?";
  const stats = [
    { icon: Clock, label: `${questionCount} Questions`, sub: "Quick Quiz" },
    {
      icon: Target,
      label: `Passing Score: ${passPct}%`,
      sub: placement === "end_of_day" ? "Final Challenge" : "Quick Quiz",
    },
    { icon: Trophy, label: "Track Progress", sub: "Stay on Track" },
  ];

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="relative mb-6">
        <div className="absolute inset-0 -m-6 rounded-full bg-primary/10 blur-xl" />
        <div className="relative grid h-28 w-28 place-items-center rounded-full bg-primary/10">
          <ClipboardCheck className="h-12 w-12 text-primary" />
        </div>
        <Sparkles className="absolute -right-2 -top-2 h-5 w-5 text-shero-gold" />
        <Sparkles className="absolute -bottom-1 -left-3 h-4 w-4 text-primary/60" />
      </div>

      <h1 className="font-display text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Test your understanding with this quiz and continue your learning
        journey.
      </p>

      <div className="mt-8 grid w-full grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1.5">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
              <s.icon className="h-4.5 w-4.5" />
            </div>
            <div className="text-xs font-semibold">{s.label}</div>
            <div className="text-[11px] text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onReviewModule}
        >
          <BookOpen className="h-4 w-4" /> Review the previous module
        </Button>
        <Button size="lg" className="flex-1" onClick={onStart}>
          <Sparkles className="h-4 w-4" /> Start Quiz
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> You can review the module
        anytime after the quiz.
      </p>
    </div>
  );
}

// ── Screen 2: one question at a time ───────────────────────────────────────

function QuizQuestionScreen({
  question,
  index,
  total,
  selected,
  bookmarked,
  onSelect,
  onToggleBookmark,
  onBack,
  onPrev,
  onNext,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: number | undefined;
  bookmarked: boolean;
  onSelect: (choiceIdx: number) => void;
  onToggleBookmark: () => void;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isLast = index === total - 1;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <Button size="sm" variant="outline" onClick={onToggleBookmark}>
          <Bookmark
            className={`h-3.5 w-3.5 ${bookmarked ? "fill-current text-primary" : ""}`}
          />
          Review
        </Button>
      </div>

      <div className="mx-auto mt-4 flex w-full max-w-sm flex-col items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Question {index + 1} of {total}
        </span>
        <div className="flex w-full gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= index ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 flex w-full max-w-lg flex-1 flex-col items-center text-center">
        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary">
          Q{index + 1}
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
          {question.question}
        </h2>

        <div className="mt-8 w-full space-y-3">
          {question.choices.map((choice, ci) => {
            const isSelected = selected === ci;
            return (
              <button
                key={ci}
                type="button"
                onClick={() => onSelect(ci)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {String.fromCharCode(65 + ci)}
                </span>
                <span
                  className={`flex-1 text-sm font-medium ${isSelected ? "text-primary" : ""}`}
                >
                  {choice}
                </span>
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    isSelected ? "border-primary" : "border-border"
                  }`}
                >
                  {isSelected && (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {selected != null && (
          <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /> Option{" "}
            {String.fromCharCode(65 + selected)} selected
          </p>
        )}
      </div>

      <div className="mx-auto mt-8 flex w-full max-w-lg items-center justify-between">
        <Button variant="outline" onClick={onPrev} disabled={index === 0}>
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <motion.div
          key={selected ?? "none"}
          initial={selected != null ? { scale: 0.9 } : false}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <Button onClick={onNext} disabled={selected == null}>
            {isLast ? "Submit Quiz" : "Next Question"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// ── Screen 3: results ───────────────────────────────────────────────────────

function performanceLabel(score: number, passed: boolean) {
  if (!passed) return { label: "Needs Improvement", emoji: "💪" };
  if (score >= 90) return { label: "Excellent", emoji: "⭐" };
  if (score >= 75) return { label: "Great Job", emoji: "🎉" };
  return { label: "Good", emoji: "👍" };
}

function QuizResultsScreen({
  score,
  passPct,
  passed,
  questions,
  answers,
  revisedContent,
  isPassing,
  onContinue,
  onRetry,
}: {
  score: number;
  passPct: number;
  passed: boolean;
  questions: QuizQuestion[];
  answers: Record<string, number>;
  revisedContent?: string;
  isPassing?: boolean;
  onContinue: () => void;
  onRetry: () => void;
}) {
  const color = passed ? "text-success" : "text-destructive";
  const performance = performanceLabel(score, passed);
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            className="fill-none stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            className={`fill-none transition-[stroke-dasharray] duration-700 ${passed ? "stroke-success" : "stroke-destructive"}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold">{score}%</span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2">
        {passed ? (
          <PartyPopper className="h-6 w-6 text-success" />
        ) : (
          <Frown className="h-6 w-6 text-destructive" />
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {passed ? "Great job!" : "Not quite there"}
        </h1>
      </div>
      <span
        className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
          passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
        }`}
      >
        {performance.emoji} {performance.label}
      </span>
      <p className={`mt-2 text-sm font-medium ${color}`}>
        {passed
          ? `You scored ${score}% — that's a pass!`
          : `You scored ${score}% — you need ${passPct}% to continue.`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Passing score: {passPct}%
      </p>

      <div className="mt-6 w-full max-w-md space-y-1.5">
        {questions.map((q, qi) => {
          const correct = answers[q.id] === q.correct_index;
          const chosenIdx = answers[q.id];
          return (
            <details
              key={q.id}
              className={`group rounded-md border text-left text-xs ${
                correct
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <summary className="flex cursor-pointer list-none items-start gap-2 px-2.5 py-1.5">
                {correct ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span className="flex-1">
                  <span className="font-medium">Q{qi + 1}.</span> {q.question}
                </span>
                <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-1.5 border-t border-current/10 px-2.5 py-2 pl-9 text-muted-foreground">
                <p>
                  Your answer:{" "}
                  <span className="font-medium">
                    {chosenIdx != null
                      ? `${String.fromCharCode(65 + chosenIdx)}. ${q.choices[chosenIdx]}`
                      : "—"}
                  </span>
                </p>
                {!correct && (
                  <p>
                    Correct answer:{" "}
                    <span className="font-medium">
                      {String.fromCharCode(65 + q.correct_index)}.{" "}
                      {q.choices[q.correct_index]}
                    </span>
                  </p>
                )}
                <p>{q.explanation || "No explanation provided."}</p>
              </div>
            </details>
          );
        })}
      </div>

      {revisedContent && (
        <div className="mt-4 w-full max-w-md rounded-md border border-border bg-muted/20 p-3 text-left text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <BookOpen className="h-3.5 w-3.5" /> Revise before your next attempt
          </div>
          <p className="whitespace-pre-wrap">{revisedContent}</p>
        </div>
      )}

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        {passed ? (
          <Button size="lg" onClick={onContinue} disabled={isPassing}>
            {isPassing && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="lg" onClick={onRetry}>
            <RotateCw className="h-4 w-4" /> Retry Quiz
          </Button>
        )}
      </div>
    </div>
  );
}

