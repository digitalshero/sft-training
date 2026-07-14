import pdfUrl from "@/assets/shero-team-guide.pdf?url";

export const TEAM_GUIDE_PDF_URL = pdfUrl;

/**
 * Downloads the team guide PDF without triggering a top-level navigation.
 * A direct <a href="..."> navigation gets intercepted by the Lovable preview
 * auth-bridge, which unloads the SPA and looks like a logout to the user.
 */
export async function downloadTeamGuidePdf() {
  const res = await fetch(pdfUrl, { credentials: "include" });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Shero-Training-Command-Center-Team-Guide.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openTeamGuidePdf() {
  window.open(pdfUrl, "_blank", "noopener,noreferrer");
}
