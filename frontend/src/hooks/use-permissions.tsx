import { useAuth } from "@/lib/auth";

export function useMyPermissions() {
  const { user, loading } = useAuth();
  const isSuperAdmin = user?.is_super_admin ?? false;
  const permissions = user?.permissions ?? [];

  const can = (key: string) => isSuperAdmin || permissions.includes(key);

  return { isLoading: loading, isSuperAdmin, permissions, can };
}

export function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { isLoading, can } = useMyPermissions();
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }
  if (!can(permission)) {
    return (
      <div className="mx-auto max-w-md rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        You don't have access to this section. Ask a super admin to grant the
        <code className="mx-1 rounded bg-background px-1 py-0.5 text-xs">{permission}</code>
        permission.
      </div>
    );
  }
  return <>{children}</>;
}
