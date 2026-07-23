import api from "@/lib/api/client";

export interface PartnerPaymentRow {
  id: string;
  external_partner_id: string | null;
  partner_name: string;
  partner_email: string;
  partner_phone: string | null;
  payment_id: string;
  amount: number;
  payment_status: "paid" | "unpaid";
  approval_status: "pending" | "accepted" | "rejected";
  invite_status: "pending" | "sent";
  created_at: string;
  invite_link: string | null;
  lp_invite_id: string | null;
}

export const listPartnerPayments = (): Promise<PartnerPaymentRow[]> =>
  api.get("/admin/partner-payments").then((r) => r.data);

// Simulates a paid-partner webhook delivery for testing — a "paid" record
// auto-triggers the same accept + invite-email pipeline the real webhook
// uses (see backend processPaidPayment), so this button exercises the
// exact same code path a real payment would.
export const createPartnerPayment = (d: {
  partner_name: string;
  partner_email: string;
  payment_id: string;
  amount: number;
  payment_status: "paid" | "unpaid";
}): Promise<PartnerPaymentRow> =>
  api.post("/admin/partner-payments", d).then((r) => r.data);

export const deletePartnerPayment = (d: { id: string }): Promise<{ ok: true }> =>
  api.delete(`/admin/partner-payments/${d.id}`).then((r) => r.data);
