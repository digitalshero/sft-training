import { createFileRoute } from "@tanstack/react-router";
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
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  CheckSquare,
  Info,
} from "lucide-react";
import { downloadTeamGuidePdf, openTeamGuidePdf } from "@/lib/download-pdf";
import { PermissionGuard } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/team-guide")({
  component: () => (
    <PermissionGuard permission="team_guide">
      <TeamGuidePage />
    </PermissionGuard>
  ),
});

const SECTIONS: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "Introduction",
    body: "What the module is, why Shero needs it, and how KOB, SFT, TTT, FAQ Bot, Certification, Retraining and Reports connect end-to-end.",
  },
  {
    n: "2",
    title: "Module Overview",
    body: "What's inside every sidebar section — Dashboard, KOB, SFT, Practice Review, Checks & Balances, Reports, Configuration, TTT Academy and more.",
  },
  {
    n: "3",
    title: "Initial Setup",
    body: "One-time configuration owned by Admin / CEO Office: geography, language, departments, roles, training paths, FAQ, certification rules.",
  },
  {
    n: "4",
    title: "Daily Business Process",
    body: "Step-by-step playbooks for the KOB team, SFT trainers, retraining and the FAQ Bot.",
  },
  {
    n: "5",
    title: "User Role Guide",
    body: "Table of pages, daily responsibilities, approvals and reports per role — CEO Office to Tech Team.",
  },
  {
    n: "6",
    title: "Automation Level Guide",
    body: "Levels 1–4 explained, plus Shero's recommended 70% automated / 30% human control model.",
  },
  {
    n: "7",
    title: "How to Run the Module",
    body: "Twelve operating steps to bring a new region, brand or team live.",
  },
  {
    n: "8",
    title: "Test Journey Guide",
    body: "How to use the three built-in demo journeys for QA and team onboarding (not for real business).",
  },
  {
    n: "9",
    title: "Reports Guide",
    body: "Eleven key reports, who reads them, and what decisions they support.",
  },
  {
    n: "10",
    title: "Final Readiness Checklist",
    body: "Sign-off checklist before declaring the module live for a region or brand.",
  },
];

function TeamGuidePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Help
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Team Guide
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The official Shero Training Command Center user guide and operating
            manual. Written for CEO Office, KOB, SFT, Trainers, PSEs,
            Operations, Admin and Tech.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadTeamGuidePdf}>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={openTeamGuidePdf}>
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>Shero Training Command Center</CardTitle>
              <Badge variant="secondary">v1.0</Badge>
            </div>
            <CardDescription className="mt-1">
              Team User Guide &amp; Operating Manual — internal circulation.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A single playbook explaining what the module is, what to configure
          first, and how each team should run their part of the partner journey
          — from first KOB call to certified, go-live partner.
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">What's inside</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {SECTIONS.map((s) => (
            <Card key={s.n} className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-accent-soft text-xs font-bold text-accent">
                    {s.n}
                  </span>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {s.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-accent" />
            <CardTitle className="text-base">
              Before Live Use — Readiness Checklist
            </CardTitle>
          </div>
          <CardDescription>
            Confirm each item before switching this module from pilot to
            production.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              "Real users and roles added",
              "Real partner/SKID data connected",
              "Real training videos uploaded",
              "Actual FAQ answers approved",
              "Actual agreement templates uploaded",
              "Payment and e-sign integrations connected",
              "WhatsApp/email notifications connected",
              "Final role permissions reviewed",
              "CEO Office approval completed",
            ].map((label) => (
              <li
                key={label}
                className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm"
              >
                <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded border border-muted-foreground/40" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-accent/40 bg-accent-soft/40">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          <FileText className="h-6 w-6 text-accent" />
          <div className="flex-1">
            <CardTitle className="text-base">Ready to circulate</CardTitle>
            <CardDescription>
              Share the PDF with your team. It's designed to be read once and
              used as a reference.
            </CardDescription>
          </div>
          <Button size="sm" onClick={downloadTeamGuidePdf}>
            <Download className="h-4 w-4" />
            Download
          </Button>
        </CardHeader>
      </Card>

      <footer className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This module is currently approved as a standalone pilot module.
          Production launch requires real data, integrations, permissions, and
          final CEO Office approval.
        </p>
      </footer>
    </div>
  );
}
