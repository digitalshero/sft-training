import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const token =
    new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ).get("token") ?? "";
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    // Call backend unsubscribe endpoint (no auth required)
    const base = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
    fetch(`${base}/email/unsubscribe?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setEmail(d.email ?? "");
          setState("done");
        } else setState("error");
      })
      .catch(() => setState("error"));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-surface max-w-md p-10 text-center">
        {state === "loading" && (
          <p className="text-sm text-muted-foreground">Processing…</p>
        )}
        {state === "done" && (
          <>
            <h1 className="text-xl font-semibold">Unsubscribed</h1>
            {email && (
              <p className="mt-2 text-sm text-muted-foreground">
                {email} has been removed from our email list.
              </p>
            )}
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="text-xl font-semibold">Invalid link</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This unsubscribe link is invalid or has already been used.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
