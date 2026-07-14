import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FloatingHelpButton } from "@/components/partner/floating-help-button";

export const Route = createFileRoute("/_authenticated/partner")({
  component: () => (
    <>
      <Outlet />
      <FloatingHelpButton />
    </>
  ),
});
