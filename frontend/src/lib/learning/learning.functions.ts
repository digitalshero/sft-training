// ── Learning functions — rewritten as Axios REST calls ─────────────────────
import api from "@/lib/api/client";

export interface Program {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  published: boolean;
  sort_order: number;
}
export interface QuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation?: string;
}
export interface SlideOverride {
  duration_seconds?: number;
  speaker_notes?: string;
  title?: string;
  voice?: string;
  speed?: number;
}
export interface ProductBrief {
  title?: string;
  instructions?: string;
  required_photos?: string[];
  reference_image_urls?: string[];
}
export interface InspectionRubricItem {
  id: string;
  label: string;
  weight: number;
  description?: string;
}
export interface InspectionRubric {
  items: InspectionRubricItem[];
  pass_pct?: number;
}
// A single positioned value on an admin-uploaded certificate design — either
// plain text (partner name / certificate ID / date) or a signature image,
// placed by dragging onto the background in the editor. Coordinates are
// percentages of the background's natural size so they scale correctly at
// any render size (editor preview, final composited download, etc).
export interface CertificateTokenPosition {
  key: string; // "partner_name" | "certificate_id" | "date" | "signature:<id>"
  label: string;
  type: "text" | "image";
  x_pct: number;
  y_pct: number;
  font_size?: number; // text tokens
  color?: string; // text tokens
  font_family?: string; // text tokens — CSS font-family stack, e.g. '"Sora", sans-serif'
  bold?: boolean; // text tokens
  italic?: boolean; // text tokens
  width_pct?: number; // image tokens — width relative to background width
  image_path?: string; // image tokens — uploaded signature file's storage path
}
// An admin-uploaded certificate background (PNG, or a PDF rasterized to PNG
// at upload time) plus where each token goes on it. When present, this
// takes over rendering/downloading from the "coded" fields below.
export interface CertificateDesign {
  background_path?: string;
  background_width?: number;
  background_height?: number;
  tokens?: CertificateTokenPosition[];
}
export interface CertificateTemplate extends CertificateDesign {
  title?: string;
  subtitle?: string;
  body_md?: string;
  signatory_name?: string;
  signatory_role?: string;
  accent_color?: string;
}
// An additional certificate template — same shape as the single main one,
// plus its own id so multiple can be defined per course and issued/tracked
// independently (see certificate_templates on Course, and LpPartnerCertificate).
export interface ExtraCertificateTemplate extends CertificateTemplate {
  id: string;
}
export interface WelcomeLetter {
  subject?: string;
  body_md?: string;
}
export interface Course {
  id: string;
  program_id: string;
  slug: string;
  title: string;
  summary: string | null;
  duration_label: string | null;
  cover_url: string | null;
  pass_pct: number;
  max_attempts: number | null;
  day5_gate_days: number;
  requires_product_upload: boolean;
  requires_inspection: boolean;
  issues_certificate: boolean;
  max_cuisines: number | null;
  published: boolean;
  sort_order: number;
  product_brief: ProductBrief;
  inspection_rubric: InspectionRubric;
  certificate_template: CertificateTemplate;
  certificate_templates: ExtraCertificateTemplate[];
  welcome_letter: WelcomeLetter;
  supported_languages: string[];
  journey_steps: string[];
  section_order: string[];
  resource_categories: string[];
  video_categories: string[];
}
export type ModuleType = "slides" | "video" | "reading" | "mixed";
export interface CourseModule {
  id: string;
  course_id: string;
  sort_order: number;
  type: ModuleType;
  title: string;
  summary: string | null;
  est_minutes: number | null;
  deck_id: string | null;
  video_url: string | null;
  reading_md: string | null;
  file_path: string | null;
  pdf_path: string | null;
  published: boolean;
  slide_overrides: Record<string, SlideOverride>;
  voice: string | null;
  language: string;
  speed: number;
  autoplay_advance: boolean;
  default_slide_seconds: number;
  quiz_enabled: boolean;
  quiz_pass_pct: number;
  quiz_questions: QuizQuestion[];
  day_id: string | null;
  quiz_placement: string;
}
export interface CourseDay {
  id: string;
  course_id: string;
  day_no: number;
  title: string;
  summary: string | null;
  unlock_after_days: number;
  sort_order: number;
}
export interface DeckRef {
  id: string;
  name: string;
  file_path: string;
  pdf_path: string | null;
  voice: string;
  speed: number;
  autoplay_advance: boolean;
}
export interface ModuleProgress {
  module_id: string;
  completed_at: string | null;
  progress_pct: number;
}
export interface PartnerInvite {
  id: string;
  course_id: string;
  recipient_name: string;
  recipient_email: string;
  kitchen_location: string | null;
  message: string | null;
  token: string;
  status: string;
  sent_at: string;
  opened_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  user_id: string | null;
}
export interface CertificateRow {
  id: string;
  user_id: string;
  course_id: string;
  code: string;
  issued_at: string;
  file_path: string | null;
}
export interface ReviewPartnerRow {
  invite_id: string;
  user_id: string | null;
  course_id: string;
  course_title: string;
  recipient_name: string;
  recipient_email: string;
  status: string;
  sent_at: string;
  accepted_at: string | null;
  modules_total: number;
  modules_done: number;
  submission_status: string | null;
  submission_id: string | null;
  submitted_at: string | null;
  certificate_code: string | null;
  certificate_issued_at: string | null;
  yet_to_start: boolean;
}
export interface ProductSubmission {
  id: string;
  user_id: string;
  course_id: string;
  files: Array<{
    path: string;
    label: string;
    decision?: string;
    remark?: string;
  }>;
  notes: string | null;
  status: string;
  feedback: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  submitted_at: string;
}

export const listPrograms = (): Promise<Program[]> =>
  api.get("/sft/programs").then((r) => r.data);
export const listCoursesForProgram = (d: {
  program_id?: string;
}): Promise<Course[]> =>
  api.get("/sft/courses", { params: d }).then((r) => r.data);
export const listAllCourses = (): Promise<Course[]> =>
  api.get("/sft/courses").then((r) => r.data);
export const getCourse = (d: { course_id: string }) =>
  api.get(`/sft/courses/${d.course_id}`).then((r) => r.data);
export const getModuleSlides = (d: { module_id: string }): Promise<{
  slides: { index: number; title: string; bullets: string[]; notes: string }[];
}> => api.get(`/learning/modules/${d.module_id}/slides`).then((r) => r.data);
export const updateCourse = (d: { course_id: string } & Partial<Course>) => {
  const { course_id, ...b } = d;
  return api.patch(`/sft/courses/${course_id}`, b).then((r) => r.data);
};
export const createCourse = (d: Partial<Course>) =>
  api.post("/sft/courses", d).then((r) => r.data);
export const updateCourseConfig = updateCourse;
export const createModule = (
  d: Partial<CourseModule> & { course_id: string },
) => api.post("/sft/modules", d).then((r) => r.data);
export const updateModule = (d: { id: string } & Partial<CourseModule>) => {
  const { id, ...b } = d;
  return api.patch(`/sft/modules/${id}`, b).then((r) => r.data);
};
export const updateModuleAdvanced = updateModule;
export const deleteModule = (d: { id: string }) =>
  api.delete(`/sft/modules/${d.id}`).then((r) => r.data);
export const reorderModules = (d: { course_id: string; order: string[] }) =>
  api.post("/sft/modules/reorder", d).then((r) => r.data);
export const listCourseDays = (d: {
  course_id: string;
}): Promise<CourseDay[]> =>
  api.get(`/sft/courses/${d.course_id}/days`).then((r) => r.data);
export const createCourseDay = (d: { course_id: string; title?: string }) =>
  api.post(`/sft/courses/${d.course_id}/days`, d).then((r) => r.data);
export const updateCourseDay = (d: { id: string } & Partial<CourseDay>) => {
  const { id, ...b } = d;
  return api.patch(`/sft/days/${id}`, b).then((r) => r.data);
};
export const deleteCourseDay = (d: { id: string }) =>
  api.delete(`/sft/days/${d.id}`).then((r) => r.data);
export const reorderCourseDays = (d: { course_id: string; order: string[] }) =>
  api.post("/sft/days/reorder", d).then((r) => r.data);
export const resetCourseDays = (d: { course_id: string }) =>
  api.post(`/sft/courses/${d.course_id}/days/reset`).then((r) => r.data);
export const listDecks = (): Promise<DeckRef[]> =>
  api.get("/sft/decks").then((r) => r.data);
export const getCourseDeck = (d: {
  course_id: string;
}): Promise<DeckRef | null> =>
  api.get(`/sft/courses/${d.course_id}/teach-data`).then((r) => r.data?.deck ?? null);
export const uploadCourseDeck = (d: {
  course_id: string;
  name: string;
  file_path: string;
  pdf_path?: string;
}) => api.post("/sft/decks", d).then((r) => r.data);
export const getDeckSignedUrl = async (d: {
  file_path: string;
  id?: string;
}) => {
  if (d.id)
    return api.post(`/sft/decks/${d.id}/signed-url`, d).then((r) => r.data);
  const a = await api.get("/sft/decks/active").then((r) => r.data);
  return a
    ? api.post(`/sft/decks/${a.id}/signed-url`, d).then((r) => r.data)
    : { url: null };
};
export const updateDeckSettings = (
  d: { id: string } & Record<string, unknown>,
) => {
  const { id, ...b } = d;
  return api.patch(`/sft/decks/${id}`, b).then((r) => r.data);
};
export const upsertSlideOverride = updateModule;
export const enrol = (d: { courseId: string }) =>
  api.post("/learning/enrol", d).then((r) => r.data);
export const myEnrolments = () =>
  api.get("/learning/my-enrolments").then((r) => r.data);
export const myCourseState = (d: { courseId: string }) =>
  api.get(`/learning/courses/${d.courseId}/my-state`).then((r) => r.data);
export const markModuleComplete = (d: { moduleId: string }) =>
  api.post(`/learning/modules/${d.moduleId}/complete`).then((r) => r.data);
export const getModuleNote = (d: {
  moduleId: string;
}): Promise<{ body: string; updated_at: string | null }> =>
  api.get(`/learning/modules/${d.moduleId}/note`).then((r) => r.data);
export const saveModuleNote = (d: { moduleId: string; body: string }) =>
  api
    .put(`/learning/modules/${d.moduleId}/note`, { body: d.body })
    .then((r) => r.data);
export const getNextQuizQuestions = (d: { moduleId: string }) =>
  api.get(`/learning/modules/${d.moduleId}/quiz/next`).then((r) => r.data);
export const submitModuleQuiz = (d: {
  moduleId: string;
  scorePct: number;
  passed: boolean;
  attemptNo: number;
  questionIds: string[];
  answers: Record<string, number>;
  placement?: string;
}) =>
  api
    .post(`/learning/modules/${d.moduleId}/quiz/submit`, d)
    .then((r) => r.data);
export const recordModuleQuizAttempt = submitModuleQuiz;
export const submitProductUpload = (d: {
  courseId: string;
  files: unknown[];
  notes?: string;
}) =>
  api
    .post(`/learning/courses/${d.courseId}/submit-product`, d)
    .then((r) => r.data);
export const myProductSubmission = (d: { courseId: string }) =>
  api.get(`/learning/courses/${d.courseId}/my-submission`).then((r) => r.data);
export const myProductSubmissionsSigned = (d: { courseId: string }) =>
  api
    .get(`/learning/courses/${d.courseId}/my-submissions-signed`)
    .then((r) => r.data);
export const myCertificate = (d: {
  courseId: string;
}): Promise<CertificateRow | null> =>
  api.get(`/learning/courses/${d.courseId}/my-certificate`).then((r) => r.data);
export const issueCertificateIfEligible = (d: { courseId: string }) =>
  api
    .post(`/learning/courses/${d.courseId}/issue-certificate`)
    .then((r) => r.data);
export const adminIssueCertificate = (d: {
  user_id: string;
  course_id: string;
}) => api.post("/sft/certificates/issue", d).then((r) => r.data);
export const adminRevokeCertificate = (d: { id: string }) =>
  api.delete(`/sft/certificates/${d.id}`).then((r) => r.data);
export interface ExtraCertificateRow {
  id: string;
  user_id: string;
  course_id: string;
  template_id: string;
  code: string;
  issued_at: string;
  revoked_at?: string | null;
}
export const listExtraCertificates = (d: {
  course_id: string;
}): Promise<ExtraCertificateRow[]> =>
  api.get("/sft/certificates/extra", { params: { course_id: d.course_id } }).then((r) => r.data);
export const adminIssueExtraCertificates = (d: {
  user_id: string;
  course_id: string;
}): Promise<{ issued: ExtraCertificateRow[] }> =>
  api.post("/sft/certificates/issue-extra", d).then((r) => r.data);
export const adminRevokeExtraCertificate = (d: { id: string }) =>
  api.delete(`/sft/certificates/extra/${d.id}`).then((r) => r.data);
export const listInvites = (d: {
  course_id: string;
}): Promise<PartnerInvite[]> =>
  api.get(`/sft/courses/${d.course_id}/invites`).then((r) => r.data);
export const listAllInvites = (): Promise<PartnerInvite[]> =>
  api.get("/sft/review").then((r) => r.data);
export const createInvite = (d: Partial<PartnerInvite>) =>
  api.post("/sft/invites", d).then((r) => r.data);
export const revokeInvite = (d: { id: string }) =>
  api.post(`/sft/invites/${d.id}/revoke`).then((r) => r.data);
export const restoreInvite = (d: { id: string }) =>
  api.post(`/sft/invites/${d.id}/restore`).then((r) => r.data);
export const sendPartnerLoginLink = (d: { invite_id: string }) =>
  api.post(`/sft/invites/${d.invite_id}/resend`).then((r) => r.data);
export const listReviewPartners = (d?: {
  courseId?: string;
}): Promise<ReviewPartnerRow[]> =>
  api.get("/sft/review", { params: d }).then((r) => r.data);
export const listEligibleForCertificate = listReviewPartners;
export const getPartnerTimeline = (d: { invite_id: string }) =>
  api.get(`/sft/invites/${d.invite_id}/events`).then((r) => r.data);
export const reviewProductSubmission = (d: {
  id: string;
  decision: string;
  feedback?: string;
  files?: unknown[];
}) => api.post(`/sft/submissions/${d.id}/review`, d).then((r) => r.data);
export const reviewProductSubmissionPerFile = reviewProductSubmission;
export const getCourseTeachData = (d: { course_id: string }) =>
  api.get(`/sft/courses/${d.course_id}/teach-data`).then((r) => r.data);
export const listCourseQuestions = (d: { course_id: string }) =>
  api.get(`/learning/courses/${d.course_id}/quiz-bank`).then((r) => r.data);
export const upsertBankQuestion = (d: unknown) =>
  api.post("/learning/quiz-questions", d).then((r) => r.data);
export const deleteBankQuestion = (d: { id: string }) =>
  api.delete(`/learning/quiz-questions/${d.id}`).then((r) => r.data);
export const createUploadSignedUrl = (d: { bucket: string; path: string }) =>
  api.post("/sft/storage/signed-upload-url", d).then((r) => r.data);
