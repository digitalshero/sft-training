import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { storeTokens, api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { requestPartnerOtp } from "@/lib/partner-login/partner-login.functions";
import { OtpVerification } from "@/components/partner-login/OtpVerification";
import { PartnerWelcomePopup } from "@/components/partner-login/PartnerWelcomePopup";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/partner-login")({
  head: () => ({
    meta: [{ title: "Partner Login — Shero Training" }],
  }),
  component: PartnerLoginPage,
});

type Step = "email" | "otp";

function PartnerLoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  async function handleContinue(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Enter your registered email address.");
      return;
    }
    setLoading(true);
    try {
      await requestPartnerOtp({ email: email.trim() });
      setStep("otp");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "This email is not on the approved partner list.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerified(tokens: {
    access_token: string;
    refresh_token: string;
  }) {
    storeTokens(tokens.access_token, tokens.refresh_token);
    const me = await api.get("/auth/me").then((r) => r.data);
    setUser(me);
    setShowWelcome(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <img
            src="/shero-logo.png"
            alt="Shero"
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
          <div>
            <div className="font-display text-base font-bold">Shero</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Training
            </div>
          </div>
        </div>

        <div className="card-surface p-8 glow-ring">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold">
              Partner sign-in
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === "email"
                ? "Enter your registered email address to receive a one-time code."
                : "Enter the one-time code we sent you."}
            </p>
          </div>

          {step === "email" ? (
            <form onSubmit={handleContinue} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Registered email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue
              </button>
            </form>
          ) : (
            <OtpVerification
              email={email.trim()}
              onVerified={handleVerified}
              onBack={() => {
                setStep("email");
                setError(null);
              }}
            />
          )}
        </div>
      </div>

      <PartnerWelcomePopup
        open={showWelcome}
        onStartLearning={() => {
          setShowWelcome(false);
          void navigate({ to: "/partner" });
        }}
      />
    </div>
  );
}
