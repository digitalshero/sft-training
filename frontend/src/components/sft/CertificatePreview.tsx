import logoAsset from "@/assets/shero-logo.png.asset.json";
const logoUrl = logoAsset.url;
import badgeUrl from "@/assets/cert-badge.svg";
import type { CertificateTemplate } from "@/lib/learning/learning.functions";
import { formatDateET } from "@/lib/datetime-et";

interface Props {
  template: CertificateTemplate;
  partnerName?: string;
  courseTitle: string;
  issuedOn?: string;
  // The unique per-partner certificate ID — only exists once a certificate
  // is actually issued, so the template designer's live preview shows a
  // placeholder instead (a real code is generated at issue time).
  certificateCode?: string;
}

export function CertificatePreview({
  template,
  partnerName = "Priya Ramesh",
  courseTitle,
  issuedOn,
  certificateCode,
}: Props) {
  const t = template ?? {};
  const accent = t.accent_color ?? "#7c3aed";
  const body = (
    t.body_md ??
    "This certifies that **{{partner_name}}** has successfully completed the {{course_title}} course."
  )
    .replace(/\{\{partner_name\}\}/g, partnerName)
    .replace(/\{\{course_title\}\}/g, courseTitle)
    .replace(/\{\{issued_on\}\}/g, issuedOn ?? formatDateET(new Date()));
  const bodyHtml = body.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  return (
    <div
      className="relative aspect-[1.414/1] w-full overflow-hidden rounded-md border-[6px] bg-[#fffdf7] text-[#1f1147] shadow-2xl"
      style={{ borderColor: accent }}
    >
      <div
        className="absolute inset-3 rounded border"
        style={{ borderColor: accent, borderWidth: 1 }}
      />
      {/* Corner flourishes, echoing the ornamented-border look of a printed certificate */}
      {(["top-3 left-3", "top-3 right-3 rotate-90", "bottom-3 left-3 -rotate-90", "bottom-3 right-3 rotate-180"] as const).map((pos) => (
        <div
          key={pos}
          className={`absolute h-4 w-4 border-t-2 border-l-2 ${pos}`}
          style={{ borderColor: accent }}
        />
      ))}
      <img
        src={badgeUrl}
        alt=""
        className="pointer-events-none absolute top-6 right-8 h-20 w-20 opacity-90"
      />
      <div className="relative flex h-full flex-col items-center justify-between px-10 py-8 text-center">
        <img src={logoUrl} alt="Shero" className="h-14" />
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.4em]" style={{ color: accent }}>
            {t.subtitle ?? "Shero Certified Partner Program"}
          </div>
          <h1 className="font-display text-3xl font-semibold md:text-4xl" style={{ color: accent }}>
            {t.title ?? "Certificate of Completion"}
          </h1>
          <p
            className="mx-auto max-w-2xl text-sm leading-relaxed md:text-base"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>
        <div className="grid w-full grid-cols-3 items-end gap-4">
          <div className="text-left">
            <div className="border-b border-foreground/40 pb-1 text-sm font-medium">
              {issuedOn ?? formatDateET(new Date())}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Date
            </div>
          </div>
          <div>
            <div className="border-b border-foreground/40 pb-1 font-mono text-sm font-medium">
              {certificateCode ?? "Assigned on issue"}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Certificate ID
            </div>
          </div>
          <div className="text-right">
            <div className="border-b border-foreground/40 pb-1 font-display text-lg italic">
              {t.signatory_name || "—"}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t.signatory_role ?? "Head of Training"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
