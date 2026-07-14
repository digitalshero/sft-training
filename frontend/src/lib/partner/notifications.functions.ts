import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/api/client";

export interface PartnerNotification {
  id: string;
  module_name: "physical_visit" | "prepare_cook" | "certificate" | "physical_visit_admin";
  message: string;
  reference_id: string | null;
  status: "unread" | "read";
  created_at: string;
  read_at: string | null;
}

export interface NotificationUnreadCounts {
  physical_visit: number;
  prepare_cook: number;
  certificate: number;
  physical_visit_admin: number;
  total: number;
}

export const listNotifications = (): Promise<PartnerNotification[]> =>
  api.get("/notifications").then((r) => r.data);

export const getNotificationUnreadCounts = (): Promise<NotificationUnreadCounts> =>
  api.get("/notifications/unread-counts").then((r) => r.data);

export const markNotificationRead = (d: { id: string }) =>
  api.post(`/notifications/${d.id}/read`).then((r) => r.data);

export const markAllNotificationsRead = () =>
  api.post("/notifications/read-all").then((r) => r.data);

export const deleteNotification = (d: { id: string }) =>
  api.delete(`/notifications/${d.id}`).then((r) => r.data);

export const clearNotificationsForModule = (d: {
  module_name: PartnerNotification["module_name"];
}) => api.delete(`/notifications/module/${d.module_name}`).then((r) => r.data);

export const NOTIFICATION_TITLE_BY_MODULE: Record<
  PartnerNotification["module_name"],
  string
> = {
  physical_visit: "Physical Visit Update",
  prepare_cook: "Prepare & Cook Update",
  certificate: "Certificate Update",
  physical_visit_admin: "Physical Visit Completed",
};

export const NOTIFICATION_ROUTE_BY_MODULE: Record<
  PartnerNotification["module_name"],
  string
> = {
  physical_visit: "/partner/visit",
  prepare_cook: "/partner/cook",
  certificate: "/partner/learn",
  physical_visit_admin: "/sft-training/physical-visit",
};

/** Shared query — sidebar and topbar both use this exact key so React Query
 *  dedupes the request instead of double-fetching. */
export function useNotificationUnreadCounts(enabled: boolean) {
  return useQuery({
    queryKey: ["notification-unread-counts"],
    queryFn: getNotificationUnreadCounts,
    enabled,
    refetchInterval: 45000,
  });
}

/** Call from a module's own page (Prepare & Cook, Physical Visit, etc.).
 *  Surfaces any pending comment for that module as a toast — since the
 *  partner is looking at the page the comment is about, this is where they
 *  actually read it — then clears it so it doesn't keep sitting as an
 *  unread badge afterwards. */
export function useClearNotificationsOnVisit(
  moduleName: PartnerNotification["module_name"],
) {
  const qc = useQueryClient();
  useEffect(() => {
    listNotifications().then((all) => {
      const mine = all.filter((n) => n.module_name === moduleName);
      if (!mine.length) return Promise.resolve();
      mine.forEach((n) => {
        toast(n.message, { duration: 8000 });
      });
      return clearNotificationsForModule({ module_name: moduleName });
    }).then(() => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-unread-counts"] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleName]);
}
