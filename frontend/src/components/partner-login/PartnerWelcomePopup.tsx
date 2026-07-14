import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Heart,
  GraduationCap,
  ChefHat,
  ShieldCheck,
  Package,
  ClipboardList,
  Trophy,
} from "lucide-react";

interface Props {
  open: boolean;
  onStartLearning: () => void;
}

const LEARNING_POINTS = [
  { icon: Sparkles, label: "Shero brand and business model" },
  { icon: ChefHat, label: "Food preparation standards" },
  { icon: ClipboardList, label: "Recipe understanding and consistency" },
  { icon: GraduationCap, label: "Kitchen operations" },
  { icon: ShieldCheck, label: "Food quality and safety practices" },
  { icon: Package, label: "Packaging and customer experience" },
  { icon: ClipboardList, label: "Order management process" },
  { icon: Trophy, label: "Partner success guidelines" },
];

export function PartnerWelcomePopup({ open, onStartLearning }: Props) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>button:last-child]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <div className="mb-2 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-8 w-8" />
          </div>
          <DialogTitle className="font-display text-2xl">
            Welcome to Shero Home Food
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-muted/30 p-4 text-left">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <Heart className="h-4 w-4 text-primary" /> What is Shero Home
              Food?
            </div>
            <p className="text-sm text-muted-foreground">
              Shero Home Food is a platform that empowers home chefs and
              kitchen partners by giving them the opportunity to build their
              own food business — backed by Shero's support, technology,
              recipes, and operational guidance.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-muted/30 p-4 text-left">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Why do we do this?
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• To empower women entrepreneurs.</li>
              <li>• To bring authentic home food to customers.</li>
              <li>
                • To help partners create sustainable income opportunities.
              </li>
              <li>
                • To provide training, technology, and support to grow
                successfully.
              </li>
            </ul>
          </section>

          <section className="rounded-lg border border-border bg-muted/30 p-4 text-left">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <GraduationCap className="h-4 w-4 text-primary" /> What will you
              learn?
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LEARNING_POINTS.map((p) => (
                <div key={p.label} className="flex items-center gap-2 text-sm">
                  <p.icon className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="text-muted-foreground">{p.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <Button size="lg" className="w-full" onClick={onStartLearning}>
          Start Learning
        </Button>
      </DialogContent>
    </Dialog>
  );
}
