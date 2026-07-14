import { useAuth } from "@/lib/auth";

export type AppRole =
  | "super_admin"
  | "admin"
  | "trainer"
  | "partner_lead"
  | "pse"
  | "kitchen_partner"
  | "inspector"
  | "partner";

export const EDITOR_ROLES: AppRole[] = ["trainer", "admin", "super_admin"];

export function useRoles() {
  const { user, loading } = useAuth();
  const roles = (user?.roles ?? []) as AppRole[];

  const has = (r: AppRole) => roles.includes(r);
  const hasAny = (rs: AppRole[]) => rs.some((r) => roles.includes(r));
  const isEditor = has("super_admin") || has("admin") || has("trainer");
  const isSuperAdmin = has("super_admin");

  return { roles, loading, has, hasAny, isEditor, isSuperAdmin };
}
