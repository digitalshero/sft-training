import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { api, storeTokens } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Shero Training" },
      {
        name: "description",
        content: "Sign in to the Shero internal training portal.",
      },
    ],
  }),
  component: LoginPage,
});

function getRoleRedirect(roles: string[]): string {
  if (roles.includes("super_admin")) {
    return "/admin/users";
  }
  if (roles.includes("admin") || roles.includes("trainer")) {
    return "/sft-training";
  }
  if (
    roles.includes("kitchen_partner") ||
    roles.includes("partner") ||
    roles.includes("partner_lead")
  ) {
    return "/partner";
  }
  return "/course";
}

function LoginPage() {
  const { user, loading: authLoading, setUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tokenLoginFailed, setTokenLoginFailed] = useState(false);

  // Redirect already-logged-in users once auth hydration completes.
  // Depends only on authLoading so this doesn't re-fire when the submit
  // handler calls setUser — that navigation is handled explicitly below.
  useEffect(() => {
    if (authLoading || !user) return;
    navigate({ to: getRoleRedirect(user.roles ?? []) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/auth/signup" : "/auth/signin";
      const payload =
        mode === "signup"
          ? { email, password, display_name: name || email.split("@")[0] }
          : { email, password };
      const { data } = await api.post(endpoint, payload);
      storeTokens(data.access_token, data.refresh_token);
      // Fetch /auth/me for up-to-date roles before deciding where to redirect.
      const me = await api.get("/auth/me").then((r) => r.data).catch(() => data.user);
      setUser(me);
      toast.success(
        mode === "signup"
          ? "Account created. You're signed in."
          : "Welcome back!",
      );
      navigate({ to: getRoleRedirect(me?.roles ?? []) });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        (err instanceof Error ? err.message : "Something went wrong");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const { token: searchToken } = Route.useSearch();

  useEffect(() => {
    if (!searchToken) return;
    storeTokens(searchToken, "");
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data);
        navigate({ to: getRoleRedirect(r.data?.roles ?? []) });
      })
      .catch(() => {
        setTokenLoginFailed(true);
        toast.error("Your invite link has expired. Please sign in below.");
      });
  }, [searchToken, navigate, setUser]);

  // A partner clicking their invite link should land straight on their
  // dashboard, not see the manual sign-in form flash by first while the
  // token exchange above resolves.
  if (searchToken && !tokenLoginFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          Signing you in…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
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
        </Link>

        <div className="card-surface mb-6 p-5 text-sm">
          <h2 className="font-display text-base font-bold text-foreground">
            Private site — Shero Home Food Training
          </h2>
          <p className="mt-2 text-muted-foreground">
            Access is restricted to authorised Shero team members and onboarded
            kitchen partners. If you've reached this page by mistake, please
            contact support.
          </p>
          <div className="mt-4 space-y-2 text-xs">
            <p className="font-semibold uppercase tracking-wider text-muted-foreground">
              Want to become a Shero Kitchen Partner?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <div className="font-semibold text-foreground">India</div>
                <a
                  href="mailto:support@shero.in"
                  className="block text-accent hover:underline"
                >
                  support@shero.in
                </a>
                <a
                  href="https://wa.me/919680666666"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  WhatsApp: +91 96806 66666
                </a>
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <div className="font-semibold text-foreground">USA</div>
                <a
                  href="mailto:support@shero.us"
                  className="block text-accent hover:underline"
                >
                  support@shero.us
                </a>
                <a
                  href="https://wa.me/14438011011"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  WhatsApp: +1 443 801 1011
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="card-surface p-8 glow-ring">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to continue your training."
                : "For Shero staff and kitchen partners."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="you@shero.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-input px-4 py-2.5 pr-11 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {mode === "signin" && (
                <div className="mt-2 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account yet?" : "Already registered?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-accent hover:underline"
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
