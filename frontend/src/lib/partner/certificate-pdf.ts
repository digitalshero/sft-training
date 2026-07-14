import jsPDF from "jspdf";
import { formatDateET } from "@/lib/datetime-et";

export interface CertPdfInput {
  course_title: string;
  code: string;
  issued_at: string;
  recipient_name?: string | null;
  signatory_name?: string | null;
  signatory_role?: string | null;
  // Optional overrides so a course's additional certificates (each with
  // their own title) don't all download as "Certificate of Completion".
  title?: string;
  subtitle?: string;
}

export function downloadCertificatePdf(c: CertPdfInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Border
  doc.setDrawColor(180, 130, 60);
  doc.setLineWidth(4);
  doc.rect(24, 24, w - 48, h - 48);
  doc.setLineWidth(1);
  doc.rect(36, 36, w - 72, h - 72);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(14);
  doc.text("SHERO HOME FOOD", w / 2, 90, { align: "center" });

  doc.setFontSize(34);
  doc.text(c.title || "Certificate of Completion", w / 2, 150, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(c.subtitle || "This is proudly presented to", w / 2, 200, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(c.recipient_name || "Partner", w / 2, 250, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("for successfully completing the Shero training course", w / 2, 290, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(c.course_title, w / 2, 330, { align: "center" });

  // Footer details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Issued: ${formatDateET(c.issued_at)}`, 80, h - 90);
  doc.text(`Certificate Code: ${c.code}`, 80, h - 70);

  if (c.signatory_name) {
    doc.text(c.signatory_name, w - 80, h - 90, { align: "right" });
    if (c.signatory_role) doc.text(c.signatory_role, w - 80, h - 70, { align: "right" });
  }

  doc.save(`certificate-${c.code}.pdf`);
}
