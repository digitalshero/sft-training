import { useRef, useState } from "react";
import api from "@/lib/api/client";
import { uploadToStorage, getSignedUrl } from "@/lib/api/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, ImageIcon, ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, PackingContainer } from "@/lib/foodcost/types";
// Packaging card supports either a linked container OR a category-level packing image fallback.
import { fmt } from "@/lib/foodcost/types";

// -------- Hero image --------
export function HeroImage({
  category,
  fallbackUrl,
  editable,
  onSaved,
}: {
  category: Category;
  fallbackUrl: string | null;
  editable: boolean;
  onSaved: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = category.hero_image_url || fallbackUrl;

  async function upload(file: File) {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `category-hero/${category.id}-${Date.now()}.${ext}`;
      const uploadError = await uploadToStorage("learning-media", path, file);
      if (uploadError) throw new Error(uploadError);
      const signedUrl = await getSignedUrl("learning-media", path);
      if (!signedUrl) throw new Error("Could not create image URL");
      const newUrl = signedUrl;
      const { error } = await api
        .patch(`/foodcost/categories/${category.id}`, { hero_image_url: newUrl })
        .then((r) => r.data);
      if (error) throw error;
      onSaved(newUrl);
      toast.success("Image updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl bg-background">
      {url ? (
        <img src={url} alt={category.name} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 opacity-40" />
        </div>
      )}
      {editable && (
        <div className="absolute bottom-2 right-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1 h-3 w-3" />
            {busy ? "Uploading…" : url ? "Change" : "Upload"}
          </Button>
        </div>
      )}
    </div>
  );
}

// -------- Costing breakdown --------
import { computePricing } from "@/lib/foodcost/pricing";

export type CostingBreakdown = {
  fc: number;
  packing: number;
  landed: number;
  ptrMargin: number;
  ppp: number;
  sheroMargin: number;
  mrp: number;
  ptrPct: number | null;
};
// eslint-disable-next-line react-refresh/only-export-components
export function computeCosting(
  _category: Category,
  fc: number,
  packing: number,
  _ccy: "inr" | "usd",
): CostingBreakdown {
  const p = computePricing(fc, packing);
  const landed = p.fc + p.packing;
  const ptrPct = p.ppp > 0 ? (p.ptrMargin / p.ppp) * 100 : null;
  return {
    fc: p.fc,
    packing: p.packing,
    landed,
    ptrMargin: p.ptrMargin,
    ppp: p.ppp,
    sheroMargin: p.sheroMargin,
    mrp: p.mrp,
    ptrPct,
  };
}

export function CostingCard({
  category,
  fcInr,
  fcUsd,
  packingInr,
  packingUsd,
  displayCurrency = "both",
}: {
  category: Category;
  fcInr: number;
  fcUsd: number;
  packingInr: number;
  packingUsd: number;
  displayCurrency?: "inr" | "usd" | "both";
}) {
  const cI = computeCosting(category, fcInr, packingInr, "inr");
  const cU = computeCosting(category, fcUsd, packingUsd, "usd");
  const currencies =
    displayCurrency === "both" ? (["inr", "usd"] as const) : ([displayCurrency] as const);
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <h3 className="font-display text-sm font-semibold">Costing</h3>
      <p className="text-[10px] text-muted-foreground">
        PTR Margin = FC × 2 · PPP = FC + PTR Margin · Shero Margin = FC × 1.6 · MRP = PPP + Shero
        Margin
      </p>
      <div className={`mt-3 grid gap-4 ${currencies.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {currencies.map((ccy) => {
          const c = ccy === "inr" ? cI : cU;
          return (
            <div key={ccy} className="space-y-1.5 text-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {ccy.toUpperCase()}
              </div>
              <Row k="Food Cost" v={fmt(c.fc, ccy)} />
              <Row k="PTR Margin" v={fmt(c.ptrMargin, ccy)} muted />
              <Row k="PPP" v={fmt(c.ppp, ccy)} />
              <Row k="Shero Margin" v={fmt(c.sheroMargin, ccy)} muted />
              <Row k="MRP" v={fmt(c.mrp, ccy)} accent />
              <Row k="Packing" v={fmt(c.packing, ccy)} muted />
              <Row k="Landed (FC+Pack)" v={fmt(c.landed, ccy)} muted />
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Row({ k, v, accent, muted }: { k: string; v: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span className="text-xs">{k}</span>
      <span className={`tabular-nums ${accent ? "font-bold text-emerald-500" : "font-medium"}`}>
        {v}
      </span>
    </div>
  );
}

// -------- Packaging --------
export function PackagingCard({
  container,
  units,
  fallbackImage,
  displayCurrency = "both",
  editable,
  onSaved,
  categoryId,
  categoryPackingImage,
  onCategoryImageSaved,
  availableContainers,
  onContainerLinked,
}: {
  container: PackingContainer | null;
  units: { id: string; code: string }[];
  fallbackImage?: string | null;
  displayCurrency?: "inr" | "usd" | "both";
  editable?: boolean;
  onSaved?: (url: string) => void;
  categoryId?: string;
  categoryPackingImage?: string | null;
  onCategoryImageSaved?: (url: string) => void;
  availableContainers?: PackingContainer[];
  onContainerLinked?: (containerId: string | null) => void;
}) {
  const imgSrc = container?.image_url || categoryPackingImage || fallbackImage || null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function uploadImage(file: File) {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      if (container) {
        const path = `packing/${container.id}-${Date.now()}.${ext}`;
        const uploadError = await uploadToStorage("learning-media", path, file);
        if (uploadError) throw new Error(uploadError);
        const signedUrl = await getSignedUrl("learning-media", path);
        if (!signedUrl) throw new Error("Could not create image URL");
        const newUrl = signedUrl;
        const { error } = await api
          .patch(`/foodcost/packing-containers/${container.id}`, { image_url: newUrl })
          .then((r) => r.data);
        if (error) throw error;
        onSaved?.(newUrl);
        toast.success("Container image updated");
      } else if (categoryId) {
        const path = `category-packing/${categoryId}-${Date.now()}.${ext}`;
        const uploadError = await uploadToStorage("learning-media", path, file);
        if (uploadError) throw new Error(uploadError);
        const signedUrl = await getSignedUrl("learning-media", path);
        if (!signedUrl) throw new Error("Could not create image URL");
        const newUrl = signedUrl;
        const { error } = await api
          .patch(`/foodcost/categories/${categoryId}`, { packing_image_url: newUrl } as never)
          .then((r) => r.data);
        if (error) throw error;
        onCategoryImageSaved?.(newUrl);
        toast.success("Packing image updated");
      } else {
        toast.error("Nothing to attach image to.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canUpload = editable && (container || categoryId);
  const uploadBtn = canUpload ? (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="mr-1 h-3 w-3" />
        {busy ? "Uploading…" : imgSrc ? "Change" : "Upload"}
      </Button>
    </>
  ) : null;

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Packaging</h3>
        {uploadBtn}
      </div>
      {editable && categoryId && availableContainers && availableContainers.length > 0 && (
        <div className="mt-2 no-print">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Linked container
          </Label>
          <Select
            value={container?.id ?? "none"}
            onValueChange={async (v) => {
              const newId = v === "none" ? null : v;
              const { error } = await api
                .patch(`/foodcost/categories/${categoryId}`, { packing_container_id: newId })
                .then((r) => r.data);
              if (error) {
                toast.error(error.message);
                return;
              }
              toast.success(newId ? "Container linked" : "Container unlinked");
              onContainerLinked?.(newId);
            }}
          >
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {availableContainers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.size_qty
                    ? ` · ${c.size_qty} ${units.find((u) => u.id === c.size_unit_id)?.code ?? ""}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {!container && !imgSrc ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No container linked.{" "}
          {editable
            ? "Upload a packing photo or link a container in Categories edit."
            : "Set one in Categories edit."}
        </p>
      ) : !container && imgSrc ? (
        <div className="mt-3 space-y-2">
          <div className="overflow-hidden rounded-xl border border-border bg-muted">
            <img src={imgSrc} alt="Packing" className="h-56 w-full object-contain" />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-4">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={container?.name ?? "Container"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-40" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1 text-sm">
            <div className="font-medium">{container?.name}</div>
            {container && (
              <>
                <div className="text-xs text-muted-foreground">
                  {container.size_qty}{" "}
                  {units.find((u) => u.id === container.size_unit_id)?.code ?? ""}
                </div>
                <div className="text-xs">
                  {displayCurrency !== "usd" ? fmt(Number(container.price_inr), "inr") : null}
                  {displayCurrency === "both" ? " · " : null}
                  {displayCurrency !== "inr" ? fmt(Number(container.price_usd), "usd") : null}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -------- Video --------
function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function VideoCard({
  category,
  editable,
  onSaved,
}: {
  category: Category;
  editable: boolean;
  onSaved: (url: string) => void;
}) {
  const [url, setUrl] = useState(category.video_url ?? "");
  const embed = category.video_url ? youtubeEmbed(category.video_url) : null;
  const isFileVideo =
    !!category.video_url && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(category.video_url);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const { error } = await api
      .patch(`/foodcost/categories/${category.id}`, { video_url: url || null })
      .then((r) => r.data);
    if (error) return toast.error(error.message);
    onSaved(url);
    toast.success("Video link saved");
  }

  async function uploadVideo(file: File) {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `category-video/${category.id}-${Date.now()}.${ext}`;
      const uploadError = await uploadToStorage("learning-media", path, file);
      if (uploadError) throw new Error(uploadError);
      const signedUrl = await getSignedUrl("learning-media", path);
      if (!signedUrl) throw new Error("Could not create video URL");
      const newUrl = signedUrl;
      const { error } = await api
        .patch(`/foodcost/categories/${category.id}`, { video_url: newUrl })
        .then((r) => r.data);
      if (error) throw error;
      setUrl(newUrl);
      onSaved(newUrl);
      toast.success("Video uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Recipe Video</h3>
        {editable && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" />
              {busy ? "Uploading…" : category.video_url ? "Change" : "Upload"}
            </Button>
          </>
        )}
      </div>
      {embed ? (
        <div className="aspect-video overflow-hidden rounded-xl border border-border">
          <iframe src={embed} className="h-full w-full" allowFullScreen title={category.name} />
        </div>
      ) : isFileVideo ? (
        <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
          <video src={category.video_url!} controls className="h-full w-full" />
        </div>
      ) : category.video_url ? (
        <a
          href={category.video_url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-dashed border-border bg-muted p-6 text-center text-sm text-primary hover:underline"
        >
          Open video link ↗
        </a>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted p-6 text-center text-xs text-muted-foreground">
          No video — upload a file or paste a link
        </div>
      )}
      {editable && (
        <div className="flex gap-2">
          <Input
            placeholder="https://youtube.com/watch?v=… or Vimeo URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

// -------- Sensory master --------
export function SensoryCard({
  category,
  editable,
  onSaved,
}: {
  category: Category;
  editable: boolean;
  onSaved: (patch: Partial<Category>) => void;
}) {
  const [c, setC] = useState(category.colour_note ?? "");
  const [k, setK] = useState(category.consistency_note ?? "");
  const [t, setT] = useState(category.taste_note ?? "");
  async function save() {
    const patch = { colour_note: c || null, consistency_note: k || null, taste_note: t || null };
    const { error } = await api
      .patch(`/foodcost/categories/${category.id}`, patch)
      .then((r) => r.data);
    if (error) return toast.error(error.message);
    onSaved(patch);
    toast.success("Sensory profile saved");
  }
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
      <h3 className="font-display text-sm font-semibold">Sensory Master</h3>
      <div className="grid gap-2">
        <Field label="Colour">
          <Input
            value={c}
            onChange={(e) => setC(e.target.value)}
            placeholder="e.g. Mild Reddish Yellow"
            disabled={!editable}
          />
        </Field>
        <Field label="Consistency">
          <Input
            value={k}
            onChange={(e) => setK(e.target.value)}
            placeholder="e.g. Thick, pourable"
            disabled={!editable}
          />
        </Field>
        <Field label="Taste">
          <Textarea
            rows={2}
            value={t}
            onChange={(e) => setT(e.target.value)}
            placeholder="e.g. Mild spice, not oily / watery"
            disabled={!editable}
          />
        </Field>
      </div>
      {editable && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save}>
            Save sensory
          </Button>
        </div>
      )}
    </div>
  );
}

// -------- ABC checklist (constant) --------
// eslint-disable-next-line react-refresh/only-export-components
export const ABC_CHECKLIST = [
  { k: "A", v: "Hygiene: made fresh, cooked with head-cap, no jewellery." },
  { k: "B", v: "Packed only after checking for foreign material — hair, insects, dust." },
  { k: "C", v: "Packaging surface cleaned and dry before use." },
];
export function AbcCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <h3 className="font-display text-sm font-semibold flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-500" /> ABC — Hygiene &amp; Packing
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {ABC_CHECKLIST.map((row) => (
          <li key={row.k} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-500">
              {row.k}
            </span>
            <span className="text-muted-foreground">{row.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------- VCR placeholder --------
export function VcrPlaceholder({
  imageUrl,
  categoryId,
  editable,
  onSaved,
}: {
  imageUrl?: string | null;
  categoryId?: string;
  editable?: boolean;
  onSaved?: (url: string) => void;
} = {}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function uploadImage(file: File) {
    if (!categoryId) return toast.error("Missing category");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `category-vcr/${categoryId}-${Date.now()}.${ext}`;
      const uploadError = await uploadToStorage("learning-media", path, file);
      if (uploadError) throw new Error(uploadError);
      const signedUrl = await getSignedUrl("learning-media", path);
      if (!signedUrl) throw new Error("Could not create image URL");
      const newUrl = signedUrl;
      const { error } = await api
        .patch(`/foodcost/categories/${categoryId}`, { vcr_image_url: newUrl })
        .then((r) => r.data);
      if (error) throw error;
      onSaved?.(newUrl);
      toast.success("VCR chart uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-elevated p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1" />
        <h3 className="font-display text-sm font-semibold text-center">
          VCR — Virtual Cat Recipe chart
        </h3>
        <div className="flex-1 text-right">
          {editable && categoryId && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1 h-3 w-3" />
                {busy ? "Uploading…" : imageUrl ? "Change" : "Upload"}
              </Button>
            </>
          )}
        </div>
      </div>
      {imageUrl ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-muted">
          <img src={imageUrl} alt="Virtual Cat Recipe chart" className="w-full object-contain" />
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Reserved space. Upload the chart image and it&apos;ll show here.
          </p>
          <div className="mt-3 aspect-video rounded-xl border border-dashed border-border/60 bg-muted/40" />
        </>
      )}
    </div>
  );
}

// -------- Mini-master health --------
export type HealthCheck = { ok: boolean; label: string; hint?: string };
// eslint-disable-next-line react-refresh/only-export-components
export function buildHealth(opts: {
  category: Category;
  recipeItemCount: number;
  container: PackingContainer | null;
  hasProductImage: boolean;
  fcInr: number;
  fcUsd: number;
}): HealthCheck[] {
  const c = opts.category;
  const fc = c.active_us ? opts.fcUsd : opts.fcInr;
  const { ppp, mrp } = computePricing(fc);
  return [
    {
      ok: !!c.crc_recipe_id && opts.recipeItemCount > 0,
      label: "CRC recipe linked with line items",
    },
    { ok: !!opts.container, label: "Packing container set" },
    { ok: !!(c.hero_image_url || opts.hasProductImage), label: "Hero image available" },
    { ok: fc > 0 && ppp > 0 && mrp > 0, label: "Costing computes (FC, PPP, MRP all > 0)" },
    {
      ok: !!(c.colour_note && c.consistency_note && c.taste_note),
      label: "Sensory profile complete (colour, consistency, taste)",
    },
    { ok: !!c.video_url, label: "Recipe video link present" },
  ];
}

export function HealthCard({ checks }: { checks: HealthCheck[] }) {
  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const tone =
    passed === total ? "text-emerald-500" : passed >= total - 1 ? "text-amber-500" : "text-red-500";
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Mini-Master Health</h3>
        <span className={`font-display text-lg font-bold ${tone}`}>
          {passed}/{total}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start gap-2">
            {c.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            )}
            <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// re-export for tree-shake friendliness
export { XCircle };
