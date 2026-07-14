import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PermissionGuard } from "@/hooks/use-permissions";
import { useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/foodcost")({
  component: FoodCostLayout,
});

function FoodCostLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  // Default permission for the section root / dashboard
  let perm = "foodcost_dashboard";
  if (pathname.startsWith("/foodcost/in")) perm = "foodcost_in";
  else if (pathname.startsWith("/foodcost/us")) perm = "foodcost_us";

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface-elevated/40 px-6 py-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Food Cost & Pricing
        </p>
        <h1 className="font-display text-2xl font-bold">
          Recipe Costing Command
        </h1>
      </header>
      <div className="flex-1 p-6">
        <PermissionGuard permission={perm}>
          <Outlet />
        </PermissionGuard>
      </div>
    </div>
  );
}
