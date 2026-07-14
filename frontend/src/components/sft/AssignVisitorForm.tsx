import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CalendarClock,
  ChefHat,
  Clock,
  Loader2,
  MapPin,
  Phone,
  Send,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  assignVisitor,
  type PhysicalVisitRow,
} from "@/lib/sft/physical-visit.functions";
import { getPartnerSelectedCuisines } from "@/lib/learning/cuisines.functions";
import { listRecipesByCuisine } from "@/lib/learning/recipes.functions";

export function AssignVisitorForm({
  visit,
  isReschedule = false,
  onDone,
  onCancel,
}: {
  visit: PhysicalVisitRow;
  isReschedule?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    visitor_name: "",
    visitor_email: "",
    visitor_phone: "",
    visit_date: "",
    visit_time: "",
    remarks: "",
    partner_location: "",
    partner_state: "",
    partner_country: "",
    partner_phone: "",
    partner_address: "",
    cuisine_id: "",
    recipe_ids: [] as string[],
  });

  useEffect(() => {
    setForm({
      visitor_name: isReschedule ? (visit.visitor_name ?? "") : "",
      visitor_email: isReschedule ? (visit.visitor_email ?? "") : "",
      visitor_phone: isReschedule ? (visit.visitor_phone ?? "") : "",
      visit_date: "",
      visit_time: "",
      remarks: "",
      partner_location: visit.partner_location ?? "",
      partner_state: visit.partner_state ?? "",
      partner_country: visit.partner_country ?? "",
      partner_phone: visit.partner_phone ?? "",
      partner_address: visit.partner_address ?? "",
      cuisine_id: visit.cuisine_id ?? "",
      recipe_ids: [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit.id, isReschedule]);

  const fnListRecipes = listRecipesByCuisine;

  const cuisinesQ = useQuery({
    queryKey: ["assign-visitor-cuisines", visit.user_id, visit.course_id],
    queryFn: () =>
      getPartnerSelectedCuisines({
        user_id: visit.user_id,
        course_id: visit.course_id,
      }),
    enabled: !!visit.course_id && !!visit.user_id,
  });
  const partnerCuisines = cuisinesQ.data?.cuisines ?? [];
  const partnerHasNoCuisines = !cuisinesQ.isLoading && partnerCuisines.length === 0;

  const recipesQ = useQuery({
    queryKey: ["assign-visitor-recipes", form.cuisine_id],
    queryFn: () =>
      fnListRecipes({
        course_id: visit.course_id,
        cuisine_id: form.cuisine_id,
      }),
    enabled: !!form.cuisine_id && !!visit.course_id,
  });

  const recipeOptions = useMemo(() => recipesQ.data ?? [], [recipesQ.data]);

  const fnAssign = assignVisitor;
  const mut = useMutation({
    mutationFn: async () => {
      if (!form.cuisine_id) throw new Error("Select a cuisine");
      if (form.recipe_ids.length === 0)
        throw new Error("Select at least one product");
      return fnAssign({ id: visit.id, ...form, isReschedule });
    },
    onSuccess: () => {
      toast.success(
        isReschedule
          ? "Visit rescheduled & emails sent"
          : "Visitor assigned & emails sent",
      );
      onDone();
    },
    onError: (e: { message?: string }) =>
      toast.error(e?.message ?? "Action failed"),
  });

  const title = isReschedule ? "Reschedule Visit" : "Assign Visitor";
  const submitLabel = isReschedule
    ? "Reschedule & Send Email"
    : "Assign Visitor";

  function toggleRecipe(id: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      recipe_ids: checked
        ? [...f.recipe_ids, id]
        : f.recipe_ids.filter((r) => r !== id),
    }));
  }

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex items-start gap-4 border-b px-6 py-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-success/10 text-success">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Schedule a visit for the visitor and partner. An email with visit
            details will be sent to the visitor.
          </p>
        </div>
      </div>

      <div className="space-y-6 px-6 py-5">
        <SectionHeading icon={MapPin} title="Partner Address" />
        <div className="relative">
          <Input
            className="pr-9"
            value={form.partner_address}
            onChange={(e) =>
              setForm((f) => ({ ...f, partner_address: e.target.value }))
            }
            placeholder="Enter partner address"
          />
          <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
        </div>

        <section className="space-y-3 rounded-2xl bg-success/5 p-4">
          <SectionHeading icon={ChefHat} title="Assigned Cooking *" iconBadge />
          <p className="text-xs text-muted-foreground">
            Cuisine options are limited to what the partner selected in
            Prepare &amp; Cook. Choose which of that cuisine&apos;s products
            the visitor will inspect — this won&apos;t change the
            partner&apos;s own selection.
          </p>

          {cuisinesQ.isLoading ? (
            <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
              Loading partner&apos;s cuisine selection…
            </div>
          ) : partnerHasNoCuisines ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  No cuisines selected by this partner.
                </p>
                <p className="mt-0.5 text-xs">
                  Partner needs to complete Prepare &amp; Cook selection
                  first.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Cuisine *</Label>
                  <Select
                    value={form.cuisine_id}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, cuisine_id: v, recipe_ids: [] }))
                    }
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select cuisine" />
                    </SelectTrigger>
                    <SelectContent>
                      {partnerCuisines.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Products *{" "}
                    {form.recipe_ids.length > 0 && (
                      <Badge variant="secondary" className="ml-2 font-normal">
                        {form.recipe_ids.length} selected
                      </Badge>
                    )}
                  </Label>
                  {!form.cuisine_id ? (
                    <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                      Select a cuisine first
                    </div>
                  ) : recipesQ.isLoading ? (
                    <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                      Loading products…
                    </div>
                  ) : recipeOptions.length === 0 ? (
                    <div className="flex h-9 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
                      No products in this cuisine
                    </div>
                  ) : null}
                </div>
              </div>
              {form.cuisine_id &&
                !recipesQ.isLoading &&
                recipeOptions.length > 0 && (
                  <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border bg-background p-2 sm:grid-cols-2">
                    {recipeOptions.map((r) => (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={form.recipe_ids.includes(r.id)}
                          onCheckedChange={(c) =>
                            toggleRecipe(r.id, c === true)
                          }
                        />
                        <span>{r.food_name}</span>
                      </label>
                    ))}
                  </div>
                )}
            </>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading icon={Calendar} title="Visit Information" accent />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DateField
              label="Visit Date"
              value={form.visit_date}
              onChange={(v) => setForm((f) => ({ ...f, visit_date: v }))}
              required
            />
            <TimeField
              label="Visit Time"
              value={form.visit_time}
              onChange={(v) => setForm((f) => ({ ...f, visit_time: v }))}
              required
            />
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Remarks (Optional)</Label>
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remarks: e.target.value }))
                }
                placeholder="Add any remarks for the visit (optional)"
              />
            </div>
          </div>
          {isReschedule && (visit.attempt_no ?? 1) >= 1 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This will create <strong>Attempt {(visit.attempt_no ?? 1) + 1}</strong>{" "}
              and invalidate the previous portal link.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeading icon={User} title="Visitor Information" accent />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Visitor Name"
              value={form.visitor_name}
              onChange={(v) => setForm((f) => ({ ...f, visitor_name: v }))}
              placeholder="Enter full name"
              required
            />
            <Field
              label="Visitor Email"
              type="email"
              value={form.visitor_email}
              onChange={(v) => setForm((f) => ({ ...f, visitor_email: v }))}
              placeholder="Enter email address"
              required
            />
            <Field
              label="Visitor Phone"
              value={form.visitor_phone}
              onChange={(v) => setForm((f) => ({ ...f, visitor_phone: v }))}
              placeholder="Enter phone number"
              icon={Phone}
            />
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading icon={Building2} title="Partner Information" accent />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Static label="Partner Name" value={visit.partner_name ?? "—"} />
            <Static label="Partner Email" value={visit.partner_email ?? "—"} />
            <Field
              label="Location"
              value={form.partner_location}
              onChange={(v) =>
                setForm((f) => ({ ...f, partner_location: v }))
              }
              placeholder="Enter location"
            />
            <Field
              label="State"
              value={form.partner_state}
              onChange={(v) => setForm((f) => ({ ...f, partner_state: v }))}
              placeholder="Select state"
            />
            <Field
              label="Country"
              value={form.partner_country}
              onChange={(v) => setForm((f) => ({ ...f, partner_country: v }))}
              placeholder="Select country"
            />
            <Field
              label="Partner Phone"
              value={form.partner_phone}
              onChange={(v) => setForm((f) => ({ ...f, partner_phone: v }))}
              placeholder="Enter phone number"
              icon={Phone}
            />
            <div className="md:col-span-2">
              <Field
                label="Partner Address"
                value={form.partner_address}
                onChange={(v) =>
                  setForm((f) => ({ ...f, partner_address: v }))
                }
                placeholder="Enter partner address"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 border-t bg-background px-6 py-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="bg-success text-white hover:bg-success/90"
          onClick={() => mut.mutate()}
          disabled={mut.isPending || partnerHasNoCuisines}
        >
          {mut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  accent = false,
  iconBadge = false,
}: {
  icon: LucideIcon;
  title: string;
  accent?: boolean;
  iconBadge?: boolean;
}) {
  return (
    <h3
      className={`flex items-center gap-2 text-sm font-semibold ${
        accent ? "text-success" : "text-foreground"
      }`}
    >
      {iconBadge ? (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-success/15 text-success">
          <Icon className="h-3.5 w-3.5" />
        </span>
      ) : (
        <Icon className="h-4 w-4 text-success" />
      )}
      {title}
    </h3>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {required ? " *" : ""}
      </Label>
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={Icon ? "pr-9" : undefined}
        />
        {Icon && (
          <Icon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
        )}
      </div>
    </div>
  );
}

function isoToDate(iso: string): Date | undefined {
  const [y, m, d] = iso ? iso.split("-").map(Number) : [];
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const PICKER_TRIGGER_CLASS =
  "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function DateField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);
  const [y, m, d] = value ? value.split("-") : [];
  const display = y && m && d ? `${d} - ${m} - ${y}` : "";

  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {required ? " *" : ""}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={PICKER_TRIGGER_CLASS}>
            <span className={display ? "" : "text-muted-foreground"}>
              {display || "DD - MM - YYYY"}
            </span>
            <Calendar className="h-4 w-4 shrink-0 text-success" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <CalendarPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) {
                onChange(dateToIso(d));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Shrunk from 280 (plus popover padding) so the whole picker fits within a
// 320px-wide phone viewport without clipping.
const CLOCK_SIZE = 240;
const CLOCK_CENTER = CLOCK_SIZE / 2;
const CLOCK_NUMBER_RADIUS = 92;

function clockPoint(index: number, total: number, radius: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: CLOCK_CENTER + radius * Math.cos(angle),
    y: CLOCK_CENTER + radius * Math.sin(angle),
  };
}

function ClockFace({
  mode,
  hour,
  minute,
  onPickHour,
  onPickMinute,
}: {
  mode: "hour" | "minute";
  hour: number | null;
  minute: number | null;
  onPickHour: (h: number) => void;
  onPickMinute: (m: number) => void;
}) {
  const numbers =
    mode === "hour"
      ? Array.from({ length: 24 }, (_, i) => i)
      : Array.from({ length: 12 }, (_, i) => i * 5);
  const selected = mode === "hour" ? hour : minute;
  const selectedIndex =
    mode === "hour" ? hour : minute !== null ? minute / 5 : null;
  const hand =
    selectedIndex !== null
      ? clockPoint(selectedIndex, numbers.length, CLOCK_NUMBER_RADIUS)
      : null;
  const handAngleDeg = hand
    ? (Math.atan2(hand.y - CLOCK_CENTER, hand.x - CLOCK_CENTER) * 180) / Math.PI - 90
    : 0;
  const handLength = hand
    ? Math.hypot(hand.x - CLOCK_CENTER, hand.y - CLOCK_CENTER)
    : 0;

  return (
    <div
      className="relative mx-auto rounded-full border border-border bg-muted/30"
      style={{ width: CLOCK_SIZE, height: CLOCK_SIZE }}
    >
      {hand && (
        <div
          className="absolute rounded-full bg-success/60"
          style={{
            left: CLOCK_CENTER - 1,
            top: CLOCK_CENTER,
            width: 2,
            height: handLength,
            transformOrigin: "top center",
            transform: `rotate(${handAngleDeg}deg)`,
          }}
        />
      )}
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success" />
      {numbers.map((n, i) => {
        const { x, y } = clockPoint(i, numbers.length, CLOCK_NUMBER_RADIUS);
        const isSelected = n === selected;
        return (
          <button
            key={n}
            type="button"
            onClick={() => (mode === "hour" ? onPickHour(n) : onPickMinute(n))}
            className={`absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] font-medium transition-colors ${
              isSelected
                ? "bg-success text-white"
                : "text-foreground hover:bg-success/15"
            }`}
            style={{ left: x, top: y }}
          >
            {String(n).padStart(2, "0")}
          </button>
        );
      })}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"hour" | "minute">("hour");
  const [hh, mm] = value ? value.split(":") : ["", ""];

  return (
    <div className="space-y-1">
      <Label className="text-xs">
        {label}
        {required ? " *" : ""}
      </Label>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setStep("hour");
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" className={PICKER_TRIGGER_CLASS}>
            <span className={value ? "" : "text-muted-foreground"}>
              {value || "--:--"}
            </span>
            <Clock className="h-4 w-4 shrink-0 text-success" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <div className="mb-3 flex items-center justify-center gap-1 text-3xl font-semibold tabular-nums">
            <button
              type="button"
              onClick={() => setStep("hour")}
              className={`rounded-md px-2 py-1 ${
                step === "hour"
                  ? "bg-success/15 text-success"
                  : "text-muted-foreground"
              }`}
            >
              {hh || "--"}
            </button>
            <span className="text-muted-foreground">:</span>
            <button
              type="button"
              onClick={() => setStep("minute")}
              className={`rounded-md px-2 py-1 ${
                step === "minute"
                  ? "bg-success/15 text-success"
                  : "text-muted-foreground"
              }`}
            >
              {mm || "--"}
            </button>
          </div>
          <ClockFace
            mode={step}
            hour={hh ? Number(hh) : null}
            minute={mm ? Number(mm) : null}
            onPickHour={(h) => {
              onChange(`${String(h).padStart(2, "0")}:${mm || "00"}`);
              setStep("minute");
            }}
            onPickMinute={(m) => {
              onChange(`${hh || "00"}:${String(m).padStart(2, "0")}`);
              setOpen(false);
            }}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              24-hour format
            </span>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Static({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
