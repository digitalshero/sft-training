import { createFileRoute } from "@tanstack/react-router";

// The actual unsubscribe link points to /api/email/unsubscribe?token=... (backend proxy).
// This file only exists so TanStack Router registers the path without crashing.
export const Route = createFileRoute("/email/unsubscribe")({
  component: () => null,
});
