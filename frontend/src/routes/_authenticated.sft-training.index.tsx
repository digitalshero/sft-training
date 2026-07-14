import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sft-training/")({
  beforeLoad: () => {
    throw redirect({ to: "/sft-training/program" });
  },
});
