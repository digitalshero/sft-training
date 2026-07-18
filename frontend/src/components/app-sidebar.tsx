import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BookOpen,
  LayoutDashboard,
  ChefHat,
  ShieldCheck,
  FileBarChart,
  BookMarked,
  Settings2,
  Users,
  UserCircle,
  GraduationCap,
  ClipboardCheck,
  Download,
  UserPlus,
  ArrowLeft,
  MapPin,
  Heart,
  LogOut,
  Headphones,
  CreditCard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMyPermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/lib/auth";
import {
  useNotificationUnreadCounts,
  type NotificationUnreadCounts,
} from "@/lib/partner/notifications.functions";

const SIDEBAR_SCROLL_KEY = "app-sidebar-scroll-top";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  permission?: string;
  moduleKey?: keyof Omit<NotificationUnreadCounts, "total">;
};

const ADMIN: NavItem[] = [
  { title: "Users & Access", url: "/admin/users", icon: Users },
];

const FOODCOST_COMMON: NavItem[] = [
  {
    title: "Food Cost Dashboard",
    url: "/foodcost",
    icon: LayoutDashboard,
    permission: "foodcost_dashboard",
  },
];

const FOODCOST_INDIA: NavItem[] = [
  {
    title: "ALC Brand Master (IN)",
    url: "/foodcost/in/brand-master",
    icon: BookOpen,
    permission: "foodcost_in",
  },
  {
    title: "ALC Menu & Costing (IN)",
    url: "/foodcost/in/menu-costing",
    icon: ChefHat,
    permission: "foodcost_in",
  },
  {
    title: "Reports (IN)",
    url: "/foodcost/in/reports-hub",
    icon: FileBarChart,
    permission: "foodcost_in",
  },
  {
    title: "Audit (IN)",
    url: "/foodcost/in/audit",
    icon: ShieldCheck,
    permission: "foodcost_in",
  },
];

const FOODCOST_USA: NavItem[] = [
  {
    title: "ALC Brand Master (US)",
    url: "/foodcost/us/brand-master",
    icon: BookOpen,
    permission: "foodcost_us",
  },
  {
    title: "ALC Menu & Costing (US)",
    url: "/foodcost/us/menu-costing",
    icon: ChefHat,
    permission: "foodcost_us",
  },
  {
    title: "Reports (US)",
    url: "/foodcost/us/reports-hub",
    icon: FileBarChart,
    permission: "foodcost_us",
  },
  {
    title: "Audit (US)",
    url: "/foodcost/us/audit",
    icon: ShieldCheck,
    permission: "foodcost_us",
  },
];

const SFT_TRAINING: NavItem[] = [
  {
    title: "Course Builder",
    url: "/sft-training/program",
    icon: Settings2,
    permission: "sft_course_builder",
  },
  {
    title: "Invite & Certify",
    url: "/sft-training/invite-certify",
    icon: UserPlus,
    permission: "sft_invite_certify",
  },
  {
    title: "SFT Review",
    url: "/sft-training/review",
    icon: ShieldCheck,
    permission: "sft_review",
  },
  {
    title: "Physical Visit",
    url: "/sft-training/physical-visit",
    icon: MapPin,
    permission: "sft_physical_visit",
  },
  {
    title: "Partner Payments",
    url: "/sft-training/partner-payments",
    icon: CreditCard,
    permission: "sft_partner_payments",
  },
];

const PARTNER_HUB: NavItem[] = [
  { title: "Partner Hub", url: "/partner", icon: UserCircle },
  {
    title: "Learn Course",
    url: "/partner/learn",
    icon: GraduationCap,
    moduleKey: "certificate",
  },
  {
    title: "Prepare & Cook",
    url: "/partner/cook",
    icon: ChefHat,
    moduleKey: "prepare_cook",
  },
  {
    title: "Physical Visit",
    url: "/partner/visit",
    icon: ClipboardCheck,
    moduleKey: "physical_visit",
  },
  { title: "Download", url: "/partner/downloads", icon: Download },
];

const HELP: NavItem[] = [
  {
    title: "Team Guide",
    url: "/team-guide",
    icon: BookMarked,
    permission: "team_guide",
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useRouterState({ select: (r) => r.location });
  const pathname = location.pathname;
  const sidebarContentRef = useRef<HTMLDivElement | null>(null);
  const { isSuperAdmin, can } = useMyPermissions();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const filter = (items: NavItem[]) =>
    items.filter((it) => !it.permission || isSuperAdmin || can(it.permission));
  const isActive = (url: string) =>
    url === "/foodcost" || url === "/partner"
      ? pathname === url
      : pathname.startsWith(url);
  const inPartnerMode =
    pathname.startsWith("/partner") || pathname.startsWith("/learn");
  const isLearnPage = pathname.startsWith("/learn");
  const { data: unreadCounts } = useNotificationUnreadCounts(inPartnerMode);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const savedScrollTop = Number(
      sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? "0",
    );
    if (sidebarContentRef.current) {
      sidebarContentRef.current.scrollTop = savedScrollTop;
    }
  }, [pathname]);

  const handleSidebarScroll = () => {
    if (!sidebarContentRef.current) return;
    sessionStorage.setItem(
      SIDEBAR_SCROLL_KEY,
      String(sidebarContentRef.current.scrollTop),
    );
  };

  return (
    <Sidebar collapsible={isLearnPage ? "offcanvas" : "icon"}>
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          to="/"
          resetScroll={false}
          className="flex items-center gap-2.5 px-2 py-2"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border/60">
            <img
              src="/shero-logo.png"
              alt="Shero"
              className="h-5 w-5 object-contain"
            />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-[13px] font-bold tracking-tight">
                Shero Home Food
              </div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Technology
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent ref={sidebarContentRef} onScroll={handleSidebarScroll}>
        {(() => {
          if (inPartnerMode) {
            const canReturn =
              isSuperAdmin ||
              can("sft_review") ||
              can("sft_invite_certify") ||
              can("sft_physical_visit") ||
              can("sft_course_builder");
            return (
              <>
                {canReturn && (
                  <SidebarGroup className="py-1">
                    <SidebarGroupContent>
                      <SidebarMenu>
                        <SidebarMenuItem>
                          <SidebarMenuButton asChild tooltip="Back to SFT">
                            <Link
                              to="/sft-training/review"
                              resetScroll={false}
                              className="flex items-center gap-2"
                            >
                              <ArrowLeft className="h-4 w-4" />
                              <span className="whitespace-nowrap">
                                Back to SFT
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                )}
                <Section
                  label="Partner Hub"
                  items={PARTNER_HUB}
                  isActive={isActive}
                  collapsed={collapsed}
                  soft={isLearnPage}
                  unreadCounts={unreadCounts}
                />
              </>
            );
          }
          return (
            <>
              <Section
                label="SFT Training"
                items={filter(SFT_TRAINING)}
                isActive={isActive}
                collapsed={collapsed}
              />
              <Section
                label="Partner Hub"
                items={filter(PARTNER_HUB)}
                isActive={isActive}
                collapsed={collapsed}
              />
              <Section
                label="Food Cost — Common"
                items={filter(FOODCOST_COMMON)}
                isActive={isActive}
                collapsed={collapsed}
              />
              <Section
                label="🇮🇳 India (INR)"
                items={filter(FOODCOST_INDIA)}
                isActive={isActive}
                collapsed={collapsed}
              />
              <Section
                label="🇺🇸 USA (USD)"
                items={filter(FOODCOST_USA)}
                isActive={isActive}
                collapsed={collapsed}
              />
              <Section
                label="Help"
                items={filter(HELP)}
                isActive={isActive}
                collapsed={collapsed}
              />
              {isSuperAdmin && (
                <Section
                  label="Administration"
                  items={ADMIN}
                  isActive={isActive}
                  collapsed={collapsed}
                />
              )}
            </>
          );
        })()}
      </SidebarContent>

      <SidebarFooter>
        {inPartnerMode && !collapsed && (
          <button
            type="button"
            onClick={() =>
              toast.info(
                "For any concerns or queries regarding SFT please Whatsapp - +1 (443) 801-1011",
              )
            }
            className="flex w-full items-center gap-2.5 rounded-2xl border border-sidebar-border p-3 text-left transition-colors hover:bg-sidebar-accent/50"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Headphones className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-sidebar-foreground">
                Need help?
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Contact support anytime.
              </span>
            </span>
          </button>
        )}
        {inPartnerMode && !isLearnPage && !collapsed && (
          <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
            <p className="text-sm italic leading-snug">
              "Every step you take today brings you closer to becoming a
              successful Shero Partner."
            </p>
            <Heart className="mt-2 h-4 w-4 fill-current" />
          </div>
        )}
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Sign out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}

function Section({
  label,
  items,
  isActive,
  collapsed,
  soft = false,
  unreadCounts,
}: {
  label: string;
  items: NavItem[];
  isActive: (url: string) => boolean;
  collapsed: boolean;
  soft?: boolean;
  unreadCounts?: NotificationUnreadCounts;
}) {
  const activeClass = soft
    ? "data-[active=true]:rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:hover:bg-primary/15"
    : "data-[active=true]:rounded-xl data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm data-[active=true]:hover:bg-primary/90";
  const storageKey = `app-sidebar-group:${label}`;
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = sessionStorage.getItem(storageKey);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(storageKey, open ? "1" : "0");
    }
  }, [open, storageKey]);
  if (items.length === 0) return null;
  return (
    <SidebarGroup className="py-1">
      {!collapsed ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button className="group/section flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/50">
              <SidebarGroupLabel className="cursor-pointer text-[13px] font-bold uppercase tracking-[0.12em] text-foreground/90 group-hover/section:text-foreground">
                {label}
              </SidebarGroupLabel>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground/70 transition-transform ${open ? "" : "-rotate-90"}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((it) => {
                  const count = it.moduleKey
                    ? unreadCounts?.[it.moduleKey] ?? 0
                    : 0;
                  return (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(it.url)}
                        tooltip={it.title}
                        className={activeClass}
                      >
                        <Link
                          to={it.url}
                          resetScroll={false}
                          className="flex items-center gap-2"
                        >
                          <NavIcon
                            icon={it.icon}
                            active={isActive(it.url)}
                            soft={soft}
                            dot={count > 0}
                          />
                          <span className="whitespace-nowrap">
                            {it.title}
                          </span>
                          {count > 0 && (
                            <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                              {count > 9 ? "9+" : count}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((it) => {
              const count = it.moduleKey
                ? unreadCounts?.[it.moduleKey] ?? 0
                : 0;
              return (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(it.url)}
                    tooltip={it.title}
                    className={activeClass}
                  >
                    <Link
                      to={it.url}
                      resetScroll={false}
                      className="flex items-center gap-2"
                    >
                      <NavIcon
                        icon={it.icon}
                        active={isActive(it.url)}
                        soft={soft}
                        dot={count > 0}
                      />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

function NavIcon({
  icon: Icon,
  active,
  soft = false,
  dot = false,
}: {
  icon: React.ElementType;
  active: boolean;
  soft?: boolean;
  dot?: boolean;
}) {
  const activeIconClass = soft ? "bg-primary/15 text-primary" : "bg-white/20";
  return (
    <span
      className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full ${
        active ? activeIconClass : "bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {dot && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
      )}
    </span>
  );
}
