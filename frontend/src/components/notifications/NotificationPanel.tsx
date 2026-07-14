import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChefHat,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/time-ago";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  NOTIFICATION_ROUTE_BY_MODULE,
  NOTIFICATION_TITLE_BY_MODULE,
  type PartnerNotification,
} from "@/lib/partner/notifications.functions";

const MODULE_ICON: Record<PartnerNotification["module_name"], typeof Bell> = {
  physical_visit: ClipboardCheck,
  prepare_cook: ChefHat,
  certificate: GraduationCap,
  physical_visit_admin: ShieldCheck,
};

export function NotificationPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const listQ = useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notification-unread-counts"] });
  };

  const removeNotification = useMutation({
    mutationFn: deleteNotification,
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });

  function openNotification(n: PartnerNotification) {
    // Once viewed, the notification has served its purpose — remove it
    // rather than leaving it sitting in the panel marked "read".
    removeNotification.mutate({ id: n.id });
    void navigate({ to: NOTIFICATION_ROUTE_BY_MODULE[n.module_name] });
  }

  const notifications = listQ.data ?? [];
  const hasUnread = notifications.some((n) => n.status === "unread");

  return (
    <div className="flex max-h-[28rem] flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {hasUnread && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {listQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Bell className="h-6 w-6 text-muted-foreground/60" />
            No notifications yet
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => {
              const Icon = MODULE_ICON[n.module_name];
              const unread = n.status === "unread";
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                      unread ? "bg-primary/5" : ""
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">
                          {NOTIFICATION_TITLE_BY_MODULE[n.module_name]}
                        </span>
                        {unread && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        )}
                      </span>
                      <span className="mt-0.5 block whitespace-pre-wrap text-xs text-muted-foreground">
                        {n.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground/70">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
