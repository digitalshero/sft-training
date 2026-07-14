import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ShieldCheck,
  ChefHat,
  GraduationCap,
  Users,
} from "lucide-react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shero Home Food Training — Private" },
      {
        name: "description",
        content:
          "Private training and operations portal for Shero Home Food kitchen partners and team.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border/60">
              <img
                src="/shero-logo.png"
                alt="Shero"
                className="h-7 w-7 object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="font-display text-sm font-bold tracking-tight">
                Shero
              </div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Home Food · Training
              </div>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Sign in <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero — editorial split */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 sm:pt-24">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent-soft px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Private · Invite only
            </div>

            <h1 className="mt-7 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              A quiet kitchen.
              <br />A <span className="gradient-text">serious</span> craft.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
              This is the internal training and operations portal for Shero Home
              Food. Access is limited to authorised team members and onboarded
              kitchen partners.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Partner login
                <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 rounded-full border border-primary/40 bg-surface-elevated px-6 py-3 text-sm font-semibold text-primary transition hover:bg-surface"
              >
                Team login
                <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Not yet a partner? Reach out below to begin onboarding.
            </p>
          </div>

          {/* Right column — logo plaque */}
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-elevated p-10 shadow-[var(--shadow-card)]">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/30 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl"
              />
              <div className="relative flex items-center gap-4">
                <div className="flex flex-1 flex-col items-center text-center">
                  <img
                    src="/shero-logo.png"
                    alt="Shero"
                    className="h-20 w-20 object-contain"
                  />
                  <div className="mt-4 h-px w-14 bg-border" />
                  <div className="mt-4">
                    <div className="font-display text-2xl font-bold tracking-tight">
                      Shero
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <div className="whitespace-nowrap">Home Food · Est.</div>
                      <div>India &amp; USA</div>
                    </div>
                  </div>
                </div>
                <img
                  src="/cook-doodle.png"
                  alt=""
                  aria-hidden
                  className="pointer-events-none h-56 w-auto shrink-0 object-contain sm:h-64"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Shero — feature row */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            <FeatureItem
              icon={<ChefHat className="h-6 w-6 text-primary" />}
              title="Trusted Recipes"
              description="Crafted, tested, and loved by thousands of families."
            />
            <FeatureItem
              icon={<GraduationCap className="h-6 w-6 text-primary" />}
              title="Expert Training"
              description="Learn, practice and grow with step-by-step guidance."
            />
            <FeatureItem
              icon={<Users className="h-6 w-6 text-primary" />}
              title="Strong Community"
              description="Be part of a growing network of kitchen partners."
            />
            <FeatureItem
              icon={<ShieldCheck className="h-6 w-6 text-primary" />}
              title="Brand You Can Trust"
              description="Built on quality, consistency and heartfelt service."
            />
          </div>
        </div>
      </section>

      {/* Become a partner */}
      <section className="border-t border-border/60 bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex flex-col items-start">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Partnership
                </div>
                <div className="mt-1 h-px w-16 bg-primary/60" />
              </div>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Become a <span className="text-primary">Shero</span> Kitchen
                Partner
              </h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Cook from home with our recipes, training, and brand. Reach the
                team in your region to start a conversation.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <ContactCard
              region="India"
              flagSrc="/indiaa.png"
              email="support@shero.in"
              whatsappLabel="+91 96806 66666"
              whatsappHref="https://wa.me/919680666666"
            />
            <ContactCard
              region="USA"
              flagSrc="/usa%20flag.png"
              email="support@shero.us"
              whatsappLabel="+1 443 801 1011"
              whatsappHref="https://wa.me/14438011011"
            />
          </div>
        </div>
      </section>

      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs sm:flex-row">
          <div>
            © {new Date().getFullYear()} Shero Home Food · Internal portal
          </div>
          <div className="flex items-center gap-2 uppercase tracking-[0.22em]">
            Authorised access only
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactCard({
  region,
  flagSrc,
  email,
  whatsappLabel,
  whatsappHref,
}: {
  region: string;
  flagSrc: string;
  email: string;
  whatsappLabel: string;
  whatsappHref: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-7 transition hover:shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={flagSrc}
            alt={`${region} flag`}
            className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
          />
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Region
            </div>
            <div className="font-display text-xl font-bold tracking-tight">
              {region}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <a
          href={`mailto:${email}`}
          className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm transition hover:border-primary/40"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
              <img
                src="/mail.png"
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            </span>
            <span className="leading-tight">
              <span className="block font-medium">{email}</span>
              <span className="block text-xs text-muted-foreground">
                Email us anytime
              </span>
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm transition hover:border-primary/40"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
              <img
                src="/whatsapp.png"
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            </span>
            <span className="leading-tight">
              <span className="block font-medium">
                WhatsApp · {whatsappLabel}
              </span>
              <span className="block text-xs text-muted-foreground">
                Chat with our team
              </span>
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
        </a>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[11px] font-medium text-primary">
        <ShieldCheck className="h-3.5 w-3.5" />
        Trusted by home cooks across {region}
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
        {icon}
      </div>
      <div className="mt-4 font-display text-base font-bold text-primary">
        {title}
      </div>
      <p className="mt-2 max-w-[14rem] text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
