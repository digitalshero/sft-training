import api from "@/lib/api/client";

export interface BaseProduct {
  id: string;
  course_id: string;
  cuisine_id: string;
  name: string;
  description: string;
  active: boolean;
  cuisine_name?: string | null;
}

export const listCourseBaseProducts = (d: {
  course_id: string;
  cuisine_id?: string;
}): Promise<BaseProduct[]> =>
  api
    .get(`/learning/courses/${d.course_id}/base-products`, {
      params: d.cuisine_id ? { cuisine_id: d.cuisine_id } : undefined,
    })
    .then((r) => r.data);
export const upsertBaseProduct = (d: Partial<BaseProduct> & { course_id: string }) =>
  api.post("/learning/base-products", d).then((r) => r.data);
export const deleteBaseProduct = (d: { id: string }) =>
  api.delete(`/learning/base-products/${d.id}`).then((r) => r.data);

export type BaseProductUpload = {
  path: string;
  url: string;
  decision: string | null;
  remark: string | null;
};
export type BaseProductDraftUpload = { path: string; url: string };
export type PartnerBaseProductRow = {
  partner_base_product_id: string;
  cuisine_id: string;
  cuisine_name: string;
  base_product_name: string;
  description: string;
  status: "not_uploaded" | "pending" | "approved" | "redo";
  admin_comment: string | null;
  uploads: BaseProductUpload[];
  draft_status: "none" | "pending" | "submitted";
  draft_uploads: BaseProductDraftUpload[];
};

export const getMyBaseProducts = (d: {
  course_id: string;
}): Promise<PartnerBaseProductRow[]> =>
  api.get(`/partner/courses/${d.course_id}/my-base-products`).then((r) => r.data);
export const uploadBaseProductDraft = (d: {
  course_id: string;
  partnerBaseProductId: string;
  path: string;
}) =>
  api
    .post(`/partner/courses/${d.course_id}/base-product-drafts/${d.partnerBaseProductId}/upload`, {
      path: d.path,
    })
    .then((r) => r.data);
export const submitBaseProductDraft = (d: {
  course_id: string;
  partnerBaseProductId: string;
}) =>
  api
    .post(`/partner/courses/${d.course_id}/base-product-drafts/${d.partnerBaseProductId}/submit`, d)
    .then((r) => r.data);
export const removeBaseProductDraftImage = (d: {
  course_id: string;
  partnerBaseProductId: string;
  path: string;
}) =>
  api
    .post(`/partner/courses/${d.course_id}/base-product-drafts/${d.partnerBaseProductId}/remove-image`, {
      path: d.path,
    })
    .then((r) => r.data);

export const reviewBaseProductSubmission = (d: {
  id: string;
  decision: string;
  feedback?: string;
  files?: unknown[];
}) =>
  api
    .post(`/sft/base-product-submissions/${d.id}/review`, d)
    .then((r) => r.data)
    .catch((e) => {
      const message = e?.response?.data?.error;
      throw message ? new Error(message) : e;
    });
