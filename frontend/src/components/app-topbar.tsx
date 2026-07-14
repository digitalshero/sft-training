import { useRouterState } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";
import { useAuth } from "@/lib/auth";
import { useNotificationUnreadCounts } from "@/lib/partner/notifications.functions";
import { Bell } from "lucide-react";
import { useEffect } from "react";

const LEGACY_THEME_KEYS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--accent-soft",
  "--border",
  "--input",
  "--ring",
  "--surface",
  "--surface-elevated",
];

export function AppTopbar() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const inPartnerMode =
    pathname.startsWith("/partner") ||
    pathname.startsWith("/learn") ||
    pathname.startsWith("/sft-training/physical-visit");
  const { data: unreadCounts } = useNotificationUnreadCounts(inPartnerMode);
  const initials =
    (user?.display_name || user?.email || "?").trim().charAt(0).toUpperCase() ||
    "?";

  useEffect(() => {
    try {
      localStorage.removeItem("shero.theme");
      const root = document.documentElement;
      LEGACY_THEME_KEYS.forEach((k) => root.style.removeProperty(k));
    } catch {
      // ignore
    }
  }, []);

  const avatar = (
    <div
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      title={user?.display_name ?? user?.email ?? undefined}
    >
      {initials}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl">
      <SidebarTrigger />
      {inPartnerMode ? (
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="relative grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {(unreadCounts?.total ?? 0) > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
              <NotificationPanel />
            </PopoverContent>
          </Popover>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user?.email}
          </span>
          {avatar}
        </div>
      ) : (
        avatar
      )}
    </header>
  );
}
