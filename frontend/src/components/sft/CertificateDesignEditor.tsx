// Lets an admin upload their own certificate artwork (PNG or PDF — a PDF is
// rasterized to PNG on upload) and drag tokens (partner name, certificate
// ID, date, signature images) onto it. Positions are stored as percentages
// of the background's natural size, so the same design renders correctly at
// any preview size and at the final composited download size.
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  uploadCertificateBackground,
  uploadSignatureImage,
  getCertificateAssetUrl,
  resolveCertFontStack,
  CERT_FONT_OPTIONS,
} from "@/lib/partner/certificate-design";
import type {
  CertificateDesign,
  CertificateTokenPosition,
} from "@/lib/learning/learning.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Trash2, PenLine, X, Bold, Italic } from "lucide-react";

const DEFAULT_TOKENS: CertificateTokenPosition[] = [
  { key: "partner_name", label: "Partner Name", type: "text", x_pct: 50, y_pct: 50, font_size: 32, color: "#111111" },
  { key: "certificate_id", label: "Certificate ID", type: "text", x_pct: 20, y_pct: 90, font_size: 14, color: "#444444" },
  { key: "date", label: "Date", type: "text", x_pct: 50, y_pct: 90, font_size: 14, color: "#444444" },
];

interface Props {
  design: CertificateDesign;
  onChange: (patch: Partial<CertificateDesign>) => void;
}

export function CertificateDesignEditor({ design, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const dragKeyRef = useRef<string | null>(null);

  const bgUrlQ = useQuery({
    queryKey: ["cert-bg", design.background_path],
    queryFn: () => getCertificateAssetUrl(design.background_path!),
    enabled: !!design.background_path,
    staleTime: 5 * 60 * 1000,
  });

  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { path, width, height } = await uploadCertificateBackground(file);
      onChange({
        background_path: path,
        background_width: width,
        background_height: height,
        tokens: design.tokens?.length ? design.tokens : DEFAULT_TOKENS,
      });
      toast.success("Certificate design uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingSig(true);
    try {
      const path = await uploadSignatureImage(file);
      const id = Math.random().toString(36).slice(2, 8);
      const token: CertificateTokenPosition = {
        key: `signature:${id}`,
        label: "Signature",
        type: "image",
        x_pct: 75,
        y_pct: 80,
        width_pct: 15,
        image_path: path,
      };
      onChange({ tokens: [...(design.tokens ?? []), token] });
      setActiveKey(token.key);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingSig(false);
    }
  }

  function updateToken(key: string, patch: Partial<CertificateTokenPosition>) {
    onChange({
      tokens: (design.tokens ?? []).map((t) => (t.key === key ? { ...t, ...patch } : t)),
    });
  }
  function removeToken(key: string) {
    onChange({ tokens: (design.tokens ?? []).filter((t) => t.key !== key) });
    if (activeKey === key) setActiveKey(null);
  }
  function removeDesign() {
    onChange({ background_path: undefined, background_width: undefined, background_height: undefined, tokens: undefined });
  }

  function onPointerDownToken(e: React.PointerEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    dragKeyRef.current = key;
    setActiveKey(key);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const key = dragKeyRef.current;
    const container = containerRef.current;
    if (!key || !container) return;
    const rect = container.getBoundingClientRect();
    const x_pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y_pct = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    updateToken(key, { x_pct, y_pct });
  }
  function onPointerUp() {
    dragKeyRef.current = null;
  }

  if (!design.background_path) {
    return (
      <div className="space-y-2">
        <Label className="text-xs">Certificate design (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Upload your own certificate artwork (PNG or PDF) and drag the
          partner name, certificate ID, date, and signatures onto it. If you
          skip this, the plain fields above are used instead.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          className="hidden"
          onChange={handleBackgroundUpload}
        />
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload certificate design
        </Button>
      </div>
    );
  }

  const activeToken = (design.tokens ?? []).find((t) => t.key === activeKey);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Certificate design</Label>
        <div className="flex gap-2">
          <input
            ref={sigInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleSignatureUpload}
          />
          <Button variant="outline" size="sm" disabled={uploadingSig} onClick={() => sigInputRef.current?.click()}>
            {uploadingSig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            Add signature
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={removeDesign}>
            <Trash2 className="h-3.5 w-3.5" /> Remove design
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag each label onto the certificate. Positions are saved automatically when you save below.
      </p>
      <div
        ref={containerRef}
        className="relative w-full select-none overflow-hidden rounded-md border border-border bg-black/5"
        style={{ aspectRatio: `${design.background_width} / ${design.background_height}` }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {bgUrlQ.data ? (
          <img src={bgUrlQ.data} alt="Certificate background" className="pointer-events-none absolute inset-0 h-full w-full object-contain" draggable={false} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {(design.tokens ?? []).map((t) => (
          <div
            key={t.key}
            onPointerDown={(e) => onPointerDownToken(e, t.key)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move whitespace-nowrap rounded border px-2 py-1 text-[11px] font-medium shadow-sm ${
              activeKey === t.key ? "border-accent bg-accent/20" : "border-border bg-white/90"
            }`}
            style={{
              left: `${t.x_pct}%`,
              top: `${t.y_pct}%`,
              ...(t.type === "text"
                ? {
                    fontFamily: resolveCertFontStack(t.font_family),
                    fontWeight: t.bold ? "bold" : undefined,
                    fontStyle: t.italic ? "italic" : undefined,
                  }
                : {}),
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {activeToken && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
          <span className="text-xs font-medium">{activeToken.label}</span>
          {activeToken.type === "text" && (
            <>
              <div className="space-y-1">
                <Label className="text-[10px]">Font size</Label>
                <Input
                  type="number"
                  className="h-7 w-20 text-xs"
                  value={activeToken.font_size ?? 24}
                  onChange={(e) => updateToken(activeToken.key, { font_size: Number(e.target.value) || 24 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Colour</Label>
                <Input
                  type="color"
                  className="h-7 w-14 p-1"
                  value={activeToken.color ?? "#111111"}
                  onChange={(e) => updateToken(activeToken.key, { color: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Font</Label>
                <Select
                  value={activeToken.font_family ?? "inter"}
                  onValueChange={(v) => updateToken(activeToken.key, { font_family: v })}
                >
                  <SelectTrigger className="h-7 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CERT_FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Style</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={activeToken.bold ? "default" : "outline"}
                    className="h-7 w-7 p-0"
                    onClick={() => updateToken(activeToken.key, { bold: !activeToken.bold })}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeToken.italic ? "default" : "outline"}
                    className="h-7 w-7 p-0"
                    onClick={() => updateToken(activeToken.key, { italic: !activeToken.italic })}
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
          {activeToken.type === "image" && (
            <div className="space-y-1">
              <Label className="text-[10px]">Width (%)</Label>
              <Input
                type="number"
                className="h-7 w-20 text-xs"
                value={activeToken.width_pct ?? 15}
                onChange={(e) => updateToken(activeToken.key, { width_pct: Number(e.target.value) || 15 })}
              />
            </div>
          )}
          {activeToken.key.startsWith("signature:") && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeToken(activeToken.key)}>
              <X className="h-3 w-3" /> Remove
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setActiveKey(null)}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}

// Read-only rendering of an uploaded design with sample values — used in the
// "Live preview" panel so admins see roughly what a partner will download,
// without the drag handles from the editor above.
export function CertificateDesignPreview({
  design,
  partnerName = "Priya Ramesh",
  certificateId = "SCP-SAMPLE-0000",
  date,
}: {
  design: CertificateDesign;
  partnerName?: string;
  certificateId?: string;
  date?: string;
}) {
  const bgUrlQ = useQuery({
    queryKey: ["cert-bg", design.background_path],
    queryFn: () => getCertificateAssetUrl(design.background_path!),
    enabled: !!design.background_path,
    staleTime: 5 * 60 * 1000,
  });
  const sigUrls = useQuery({
    queryKey: ["cert-sig-urls", design.tokens?.map((t) => t.image_path).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        (design.tokens ?? [])
          .filter((t) => t.type === "image" && t.image_path)
          .map(async (t) => [t.key, await getCertificateAssetUrl(t.image_path!)] as const),
      );
      return Object.fromEntries(entries);
    },
    enabled: (design.tokens ?? []).some((t) => t.type === "image"),
    staleTime: 5 * 60 * 1000,
  });

  const values: Record<string, string> = {
    partner_name: partnerName,
    certificate_id: certificateId,
    date: date ?? new Date().toLocaleDateString(),
  };

  if (!design.background_path) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-border bg-black/5"
      style={{ aspectRatio: `${design.background_width} / ${design.background_height}` }}
    >
      {bgUrlQ.data && (
        <img src={bgUrlQ.data} alt="Certificate preview" className="absolute inset-0 h-full w-full object-contain" />
      )}
      {(design.tokens ?? []).map((t) => {
        if (t.type === "text") {
          return (
            <span
              key={t.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
              style={{
                left: `${t.x_pct}%`,
                top: `${t.y_pct}%`,
                fontSize: t.font_size,
                color: t.color,
                fontFamily: resolveCertFontStack(t.font_family),
                fontWeight: t.bold ? "bold" : undefined,
                fontStyle: t.italic ? "italic" : undefined,
              }}
            >
              {values[t.key] ?? ""}
            </span>
          );
        }
        const url = sigUrls.data?.[t.key];
        if (!url) return null;
        return (
          <img
            key={t.key}
            src={url}
            alt="Signature"
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${t.x_pct}%`, top: `${t.y_pct}%`, width: `${t.width_pct ?? 15}%` }}
          />
        );
      })}
    </div>
  );
}
