import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { PermissionGuard } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/sft-training")({
  component: SftTrainingLayout,
});

function SftTrainingLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const perm = pathname.startsWith("/sft-training/review")
    ? "sft_review"
    : pathname.startsWith("/sft-training/physical-visit")
      ? "sft_physical_visit"
      : pathname.startsWith("/sft-training/invite-certify")
        ? "sft_invite_certify"
        : pathname.startsWith("/sft-training/partner-payments")
          ? "sft_partner_payments"
          : "sft_course_builder";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Shero Food Technology
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          Learning Admin
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the Shero Certified Partner Program — courses, modules,
          slide decks, quizzes and reviews.
        </p>
      </header>
      <PermissionGuard permission={perm}>
        <Outlet />
      </PermissionGuard>
    </div>
  );
}
