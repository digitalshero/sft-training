import api from "@/lib/api/client";

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  is_super_admin: boolean;
  permissions: string[];
}

export const listAppUsers = async (): Promise<AdminUserRow[]> =>
  api.get("/admin/users").then((r) => r.data);

export const createAppUser = async (data: {
  email: string;
  password: string;
  display_name?: string;
  is_super_admin?: boolean;
  permissions?: string[];
}) => api.post("/admin/users", data).then((r) => r.data);

export const deleteAppUser = async (data: { user_id: string }) =>
  api.delete(`/admin/users/${data.user_id}`).then((r) => r.data);

export const setUserPermissions = async (data: {
  user_id: string;
  permissions: string[];
  is_super_admin: boolean;
}) => api.put(`/admin/users/${data.user_id}/permissions`, data).then((r) => r.data);

export const resetUserPassword = async (data: { user_id: string; password: string }) =>
  api.post(`/admin/users/${data.user_id}/reset-password`, data).then((r) => r.data);

export const getMyPermissions = async () => api.get("/auth/permissions").then((r) => r.data);
