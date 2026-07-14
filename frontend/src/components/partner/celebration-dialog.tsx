// Shared visual chrome for stage-completion popups (day complete, cook
// approved, learn & cook unlocked, certificate ready): icon-in-circle with
// leaf accents, bold title, divider, confetti burst, rounded pill buttons.
import * as React from "react";
import { X, Leaf, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  body?: React.ReactNode;
  footer: React.ReactNode;
  footerClassName?: string;
}

export function CelebrationDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  body,
  footer,
  footerClassName = "flex flex-wrap items-center justify-center gap-2 px-6 pb-6",
}: Props) {
  React.useEffect(() => {
    if (!open) return;
    const root = getComputedStyle(document.documentElement);
    void import("canvas-confetti").then(({ default: confetti }) => {
      void confetti({
        particleCount: 130,
        spread: 80,
        origin: { y: 0.6 },
        colors: [
          root.getPropertyValue("--success").trim(),
          root.getPropertyValue("--accent").trim(),
          root.getPropertyValue("--shero-gold").trim(),
        ],
      });
    });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-none p-0 sm:max-w-md [&>button:last-child]:hidden">
        <DialogClose asChild>
          <button
            type="button"
            className="absolute right-4 top-4 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogClose>

        <DialogHeader className="flex flex-col items-center px-6 pt-10 text-center">
          <div className="relative mb-4 grid h-24 w-24 place-items-center rounded-full bg-success/15">
            <Leaf className="absolute left-0 top-1/2 h-6 w-6 -translate-x-1 -translate-y-1/2 -scale-x-100 text-success/50" />
            <Icon className="h-11 w-11 text-success" />
            <Leaf className="absolute right-0 top-1/2 h-6 w-6 translate-x-1 -translate-y-1/2 text-success/50" />
          </div>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-base text-foreground">
            {description}
          </DialogDescription>
          <div className="mt-4 h-0.5 w-14 rounded-full bg-success/50" />
          {body && <div className="mt-4 text-sm text-muted-foreground">{body}</div>}
        </DialogHeader>
        <DialogFooter className={footerClassName}>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Standard rounded-pill button used inside CelebrationDialog footers. */
export const celebrationButtonClass = "w-full rounded-full sm:w-auto";
