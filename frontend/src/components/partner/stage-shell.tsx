import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  getPartnerDashboard,
  type PartnerDashboard,
  type PartnerInviteSummary,
} from "@/lib/partner/partner.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/partner/page-hero";
import {
  ArrowLeft,
  Loader2,
  Lock,
  BookOpen,
  ChefHat,
  UploadCloud,
  ClipboardCheck,
  Award,
  Download,
  type LucideIcon,
} from "lucide-react";

function usePartnerData() {
  const fn = getPartnerDashboard;
  return useQuery({ queryKey: ["partner-dash"], queryFn: () => fn() });
}

export type StageKey =
  "learn" | "cook" | "upload" | "visit" | "certificate" | "downloads";

const STAGE_ICON: Record<StageKey, LucideIcon> = {
  learn: BookOpen,
  cook: ChefHat,
  upload: UploadCloud,
  visit: ClipboardCheck,
  certificate: Award,
  downloads: Download,
};

const STAGE_EYEBROW: Record<StageKey, string> = {
  learn: "Step 1 · Learn",
  cook: "Step 2 · Cook",
  upload: "Step 3 · Upload",
  visit: "Step 4 · Visit",
  certificate: "Final · Certificate",
  downloads: "Resources",
};

function stageUnlocked(
  key: StageKey,
  prog:
    | {
        modules_total: number;
        modules_done: number;
        submission_status: string | null;
      }
    | undefined,
  hasCert: boolean,
): { unlocked: boolean; waitingFor?: string } {
  const allDone =
    !!prog &&
    prog.modules_total > 0 &&
    prog.modules_done === prog.modules_total;
  const subStatus = prog?.submission_status ?? null;
  switch (key) {
    case "learn":
    case "downloads":
      return { unlocked: true };
    case "cook":
      return allDone
        ? { unlocked: true }
        : { unlocked: false, waitingFor: "Finish all learning modules first." };
    case "upload":
      return allDone
        ? { unlocked: true }
        : {
            unlocked: false,
            waitingFor: "Finish all learning modules to unlock photo upload.",
          };
    case "visit":
      return subStatus === "approved"
        ? { unlocked: true }
        : {
            unlocked: false,
            waitingFor:
              "Your trainer needs to approve your cooked-product photos before scheduling a physical visit.",
          };
    case "certificate":
      return hasCert || subStatus === "approved"
        ? { unlocked: true }
        : {
            unlocked: false,
            waitingFor:
              "Your certificate appears here after your trainer approves your work.",
          };
  }
}

export function StageShell({
  title,
  subtitle,
  stage,
  heroSlot,
  children,
}: {
  title: string;
  subtitle?: string;
  stage: StageKey;
  /** Replace the default PageHero with fully custom header markup. */
  heroSlot?: ReactNode;
  children: (ctx: {
    invite: PartnerInviteSummary;
    data: PartnerDashboard;
  }) => ReactNode;
}) {
  const dashQ = usePartnerData();
  if (dashQ.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }
  const data = dashQ.data;
  const invite = data?.invites[0];

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col overflow-y-auto">
      {/* Soft teal background: gradient wash + drifting blobs + dotted texture */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-linear-to-br from-primary/5 via-transparent to-shero-gold/5">
        <motion.div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
          animate={{ x: [0, 24, 0], y: [0, 16, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-10 top-1/3 h-56 w-56 rounded-full bg-shero-emerald/10 blur-3xl"
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-shero-gold/10 blur-3xl"
          animate={{ x: [0, 18, 0], y: [0, -18, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(13,148,136,0.12) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6"
      >
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="group -ml-2 text-muted-foreground transition-colors hover:text-primary"
        >
          <Link to="/partner">
            <ArrowLeft className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1" />{" "}
            Partner Hub
          </Link>
        </Button>

      {heroSlot ?? (
        <PageHero
          eyebrow={STAGE_EYEBROW[stage]}
          title={title}
          subtitle={subtitle}
          icon={STAGE_ICON[stage]}
        />
      )}

      {!invite || !data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You don&apos;t have an active invite yet. Please check with your
            trainer.
          </CardContent>
        </Card>
      ) : (
        (() => {
          const prog = data.progress[invite.course_id];
          const hasCert = data.certificates.some(
            (c) => c.course_id === invite.course_id,
          );
          const gate = stageUnlocked(stage, prog, hasCert);
          if (!gate.unlocked) {
            return (
              <Card className="border-dashed bg-gradient-to-br from-muted/40 to-transparent">
                <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background shadow-sm">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-display text-base font-semibold">
                      This step is locked
                    </div>
                    <p className="max-w-md text-sm text-muted-foreground">
                      {gate.waitingFor}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return <>{children({ invite, data })}</>;
        })()
      )}
      </motion.div>
    </div>
  );
}
