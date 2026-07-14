import api from "@/lib/api/client";
import type { CertificateDesign } from "@/lib/learning/learning.functions";

export interface PartnerInviteSummary {
  id: string;
  course_id: string;
  course_title: string;
  recipient_name: string;
  recipient_email: string;
  status: string;
  sent_at: string;
  accepted_at: string | null;
  user_id: string | null;
  revoked_at: string | null;
  cover_url: string | null;
}
export interface PartnerTask {
  id: string;
  invite_id: string;
  title: string;
  body: string | null;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}
export interface PartnerResource {
  id: string;
  course_id: string | null;
  title: string;
  category: string;
  file_path: string;
  bucket: string;
  brand_id: string | null;
  sort_order: number;
  signed_url?: string | null;
}
export interface PartnerVideo {
  id: string;
  course_id: string | null;
  brand_id: string | null;
  category: string;
  title: string;
  description: string | null;
  video_path: string | null;
  external_url: string | null;
  bucket: string;
  thumbnail_path: string | null;
  sort_order: number;
  signed_url?: string | null;
  thumbnail_url?: string | null;
}
export interface PartnerCertificate {
  id: string;
  course_id: string;
  course_title: string;
  code: string;
  issued_at: string;
  design: CertificateDesign;
}
// One of a course's additional certificates (beyond the single main one
// above), issued to this partner — see certificate_templates on Course.
export interface PartnerExtraCertificate {
  id: string;
  course_id: string;
  course_title: string;
  template_id: string;
  title: string;
  code: string;
  issued_at: string;
  design: CertificateDesign;
}
export interface PartnerDashboard {
  invites: PartnerInviteSummary[];
  tasks: PartnerTask[];
  certificates: PartnerCertificate[];
  extra_certificates: PartnerExtraCertificate[];
  progress: Record<
    string,
    { modules_total: number; modules_done: number; submission_status: string | null }
  >;
}

export interface PartnerActivity {
  id: string;
  type: string;
  label: string;
  at: string;
}
export interface PartnerInsights {
  streak_days: number;
  today_goal: { label: string; done: boolean } | null;
  recent_activity: PartnerActivity[];
}

export const getPartnerDashboard = (): Promise<PartnerDashboard> =>
  api.get("/partner/dashboard").then((r) => r.data);
export const getPartnerInsights = (): Promise<PartnerInsights> =>
  api.get("/partner/insights").then((r) => r.data);
export const listPartnerResources = (d: { course_id?: string }): Promise<PartnerResource[]> =>
  api.get("/partner/resources", { params: d }).then((r) => r.data);
export const listPartnerVideos = (d: {
  course_id?: string;
  brand_id?: string;
}): Promise<PartnerVideo[]> => api.get("/partner/videos", { params: d }).then((r) => r.data);
export const markTaskDone = (d: { id: string; done: boolean }) =>
  api.post(`/partner/tasks/${d.id}/toggle`, { done: d.done }).then((r) => r.data);
export const createUploadSignedUrl = (d: { bucket: string; path: string }) =>
  api.post("/sft/storage/signed-upload-url", d).then((r) => r.data);

// Admin resource/video management
export const upsertPartnerResource = (d: Partial<PartnerResource>) =>
  api.post(d.id ? `/sft/resources/${d.id}` : "/sft/resources", d).then((r) => r.data);
export const deletePartnerResource = (d: { id: string }) =>
  api.delete(`/sft/resources/${d.id}`).then((r) => r.data);
export const listAllPartnerResources = (d?: { course_id?: string }) =>
  api.get("/sft/resources", { params: d }).then((r) => r.data);
export const upsertPartnerVideo = (d: Partial<PartnerVideo>) =>
  api.post(d.id ? `/sft/videos/${d.id}` : "/sft/videos", d).then((r) => r.data);
export const deletePartnerVideo = (d: { id: string }) =>
  api.delete(`/sft/videos/${d.id}`).then((r) => r.data);
export const listAllPartnerVideos = (d?: { course_id?: string }) =>
  api.get("/sft/videos", { params: d }).then((r) => r.data);
export const createPartnerTask = (d: Partial<PartnerTask>) =>
  api.post("/sft/tasks", d).then((r) => r.data);
export const deletePartnerTask = (d: { id: string }) =>
  api.delete(`/sft/tasks/${d.id}`).then((r) => r.data);
export const listInviteTasks = (d: { invite_id: string }) =>
  api.get(`/sft/invites/${d.invite_id}/tasks`).then((r) => r.data);
export const sendPartnerLoginLink = (d: { invite_id: string }) =>
  api.post(`/sft/invites/${d.invite_id}/resend`).then((r) => r.data);
