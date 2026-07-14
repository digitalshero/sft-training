import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  resendPartnerOtp,
  verifyPartnerOtp,
} from "@/lib/partner-login/partner-login.functions";

interface Props {
  email: string;
  onVerified: (tokens: { access_token: string; refresh_token: string }) => void;
  onBack: () => void;
}

function errorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data
      ?.error ?? fallback
  );
}

function isExpired(err: unknown): boolean {
  return Boolean(
    (err as { response?: { data?: { expired?: boolean } } })?.response?.data
      ?.expired,
  );
}

export function OtpVerification({ email, onVerified, onBack }: Props) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setExpired(false);
    if (otp.trim().length !== 6) {
      setError("Enter the 6-digit code sent to your email.");
      return;
    }
    setVerifying(true);
    try {
      const tokens = await verifyPartnerOtp({ email, otp: otp.trim() });
      onVerified(tokens);
    } catch (err) {
      setError(errorMessage(err, "Invalid OTP. Please try again."));
      setExpired(isExpired(err));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    setExpired(false);
    try {
      await resendPartnerOtp({ email });
      toast.success("A new code has been sent to your email.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't resend the code — try again shortly."));
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          6-digit code
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-center text-lg tracking-[0.5em] outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          placeholder="------"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Sent to <span className="font-medium text-foreground">{email}</span>
          . Expires in 10 minutes.
        </p>
      </div>

      {error && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
          {expired && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline disabled:opacity-60"
            >
              {resending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send me a new code
            </button>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={verifying}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
        Verify
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Use a different email
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-accent hover:underline disabled:opacity-60"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </form>
  );
}
