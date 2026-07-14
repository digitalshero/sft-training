import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  right?: ReactNode;
  children?: ReactNode;
}

/**
 * Flat, admin-style page header used across partner & learn pages.
 * No gradient, no decorative orbs — matches the look of other admin pages
 * (e.g. /sft-training, /foodcost) so the partner view feels like the rest
 * of the app.
 */
export function PageHero({ eyebrow, title, subtitle, icon: Icon, right, children }: PageHeroProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>

      {children && <div>{children}</div>}
    </section>
  );
}
