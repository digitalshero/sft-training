import api from "@/lib/api/client";

export interface Cuisine {
  id: string;
  course_id: string;
  name: string;
  sort_order: number;
  show_count: number;
  active: boolean;
  recipe_count?: number;
}

export const listCuisines = (d: { course_id: string }): Promise<Cuisine[]> =>
  api.get(`/learning/courses/${d.course_id}/cuisines`).then((r) => r.data);
export const upsertCuisine = (d: Partial<Cuisine> & { course_id: string }) =>
  api.post("/learning/cuisines", d).then((r) => r.data);
export const deleteCuisine = (d: { id: string }) =>
  api.delete(`/learning/cuisines/${d.id}`).then((r) => r.data);
export const listPartnerCuisines = (d: {
  course_id: string;
}): Promise<{ max_cuisines: number | null; cuisines: Cuisine[] }> =>
  api.get(`/partner/courses/${d.course_id}/cuisines`).then((r) => r.data);
/** Admin-facing: the cuisines a specific partner has actually selected in
 *  their own Prepare & Cook journey — used to constrain the Physical Visit
 *  scheduling form's cuisine dropdown to that partner's real selection. */
export const getPartnerSelectedCuisines = (d: {
  user_id: string;
  course_id: string;
}): Promise<{ cuisines: Cuisine[] }> =>
  api
    .get(`/sft/partners/${d.user_id}/courses/${d.course_id}/selected-cuisines`)
    .then((r) => r.data);
export const getMyCookAssignments = (d: { course_id: string }) =>
  api.get(`/partner/courses/${d.course_id}/my-cook-assignments`).then((r) => r.data);
export const chooseCuisine = (d: { course_id: string; cuisineId: string }) =>
  api
    .post(`/partner/courses/${d.course_id}/choose-cuisine`, { cuisineId: d.cuisineId })
    .then((r) => r.data);
export const resetMyCuisine = (d: { course_id: string }) =>
  api.post(`/partner/courses/${d.course_id}/reset-cuisine`).then((r) => r.data);
export const removeCuisine = (d: { course_id: string; cuisineId: string }) =>
  api
    .post(`/partner/courses/${d.course_id}/cuisines/${d.cuisineId}/remove`)
    .then((r) => r.data);
export const submitCookUploads = (d: { course_id: string; files: unknown[]; notes?: string }) =>
  api.post(`/partner/courses/${d.course_id}/submit-cook`, d).then((r) => r.data);
export const uploadCookDraft = (d: { course_id: string; assignmentId: string; path: string }) =>
  api
    .post(`/partner/courses/${d.course_id}/cook-drafts/${d.assignmentId}/upload`, { path: d.path })
    .then((r) => r.data);
export const submitCookDraft = (d: { course_id: string; assignmentId: string }) =>
  api
    .post(`/partner/courses/${d.course_id}/cook-drafts/${d.assignmentId}/submit`)
    .then((r) => r.data);
export const removeCookDraftImage = (d: { course_id: string; assignmentId: string; path: string }) =>
  api
    .post(`/partner/courses/${d.course_id}/cook-drafts/${d.assignmentId}/remove-image`, { path: d.path })
    .then((r) => r.data);
