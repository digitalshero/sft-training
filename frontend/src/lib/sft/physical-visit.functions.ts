import api from "@/lib/api/client";

export type PhysicalVisitPhoto = {
  id: string;
  product_id?: string | null;
  caption: string | null;
  signed_url: string | null;
  uploaded_at: string;
};
export type AssignedProduct = { product_id: string; product_name: string };
export type ProductInspectionStatus = "pending" | "accepted" | "rejected";
export type ProductInspection = {
  product_id: string;
  product_name?: string;
  status: ProductInspectionStatus;
  comment: string | null;
};
export type PhysicalVisitHistoryRow = {
  id: string;
  attempt_no: number;
  visitor_name: string | null;
  visitor_email: string | null;
  decision: string | null;
  comments: string | null;
  submitted_at: string | null;
  assigned_products: string[];
  photos: PhysicalVisitPhoto[];
  total_products: number | null;
  accepted_products: number | null;
  rejected_products: number | null;
  inspection_percentage: number | null;
  product_inspections: ProductInspection[];
};
export type PhysicalVisitRow = {
  id: string;
  user_id: string;
  course_id: string;
  recipe_id: string | null;
  submission_id: string | null;
  attempt_no: number;
  partner_name: string | null;
  partner_email: string | null;
  partner_location: string | null;
  partner_state: string | null;
  partner_country: string | null;
  partner_phone: string | null;
  partner_address: string | null;
  recipe_name: string | null;
  cuisine_id: string | null;
  cuisine_name: string | null;
  assigned_products: string[];
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  visit_date: string | null;
  visit_time: string | null;
  remarks: string | null;
  status: string;
  email_status: string;
  visitor_email_sent_at: string | null;
  partner_email_sent_at: string | null;
  submitted_at: string | null;
  decision: string | null;
  decision_comments: string | null;
  total_products: number | null;
  accepted_products: number | null;
  rejected_products: number | null;
  inspection_percentage: number | null;
  product_inspections: ProductInspection[];
  visitor_location: string | null;
  form_status: string;
  history: PhysicalVisitHistoryRow[];
  photos: PhysicalVisitPhoto[];
};
export type VisitorPortalData = {
  visit_id: string;
  status: string;
  attempt_no: number;
  already_submitted: boolean;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  visitor_location: string | null;
  partner_name: string | null;
  partner_location: string | null;
  partner_state: string | null;
  partner_country: string | null;
  cuisine_name: string | null;
  assigned_products: AssignedProduct[];
  product_inspections: ProductInspection[];
  visit_date: string;
  visit_time: string;
  remarks: string | null;
  photos: PhysicalVisitPhoto[];
};

export const listPhysicalVisits = (d?: {
  status?: string;
  search?: string;
}): Promise<PhysicalVisitRow[]> =>
  api.get("/sft/physical-visits", { params: d }).then((r) => r.data);
export const getMyPhysicalVisit = (): Promise<PhysicalVisitRow | null> =>
  api.get("/partner/my-physical-visit").then((r) => r.data);
export const assignVisitor = (d: { id: string } & Record<string, unknown>) =>
  api.post(`/sft/physical-visits/${d.id}/assign`, d).then((r) => r.data);
export const resendVisitEmails = (d: { id: string; target?: string }) =>
  api.post(`/sft/physical-visits/${d.id}/resend-emails`, d).then((r) => r.data);
export const getVisitorPortalData = (d: { token: string }): Promise<VisitorPortalData> =>
  api
    .get("/public/physical-visit", { params: d, headers: { Authorization: "" } })
    .then((r) => r.data);
export const submitVisitorVerification = (d: {
  token: string;
  decision: string;
  comments?: string;
}) =>
  api
    .post("/public/physical-visit/submit", d, { headers: { Authorization: "" } })
    .then((r) => r.data);
