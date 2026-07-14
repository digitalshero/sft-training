import api from "@/lib/api/client";

export type EmailLogWindow = "24h" | "7d" | "30d";

export interface EmailLogRow {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: "pending" | "sent" | "failed" | "suppressed";
  error_message: string | null;
  created_at: string;
}

export interface EmailLogCounts {
  total: number;
  sent: number;
  failed: number;
  suppressed: number;
  pending: number;
}

export interface EmailLogResponse {
  counts: EmailLogCounts;
  templates: string[];
  rows: EmailLogRow[];
}

export const listEmailLog = (d: {
  window: EmailLogWindow;
  template?: string;
  status?: string;
  search?: string;
}): Promise<EmailLogResponse> =>
  api.get("/admin/email-log", { params: d }).then((r) => r.data);

export const resendEmailLog = (d: { id: string }): Promise<{ ok: true }> =>
  api.post(`/admin/email-log/${d.id}/resend`).then((r) => r.data);
