import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAppUsers,
  createAppUser,
  deleteAppUser,
  setUserPermissions,
  resetUserPassword,
  type AdminUserRow,
} from "@/lib/admin/admin.functions";
import { PERMISSION_GROUPS } from "@/lib/admin/permissions";
import { useMyPermissions } from "@/hooks/use-permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const me = useMyPermissions();
  if (me.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }
  if (!me.isSuperAdmin) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        This area is restricted to super admins.
      </div>
    );
  }
  return <AdminUsersInner />;
}

function AdminUsersInner() {
  const qc = useQueryClient();
  const fnList = listAppUsers;
  const fnDel = deleteAppUser;
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => fnList() });
  const del = useMutation({
    mutationFn: fnDel,
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Administration
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            Users & Access Control
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create accounts, grant or revoke access to each section of the app,
            and reset passwords.
          </p>
        </div>
        <CreateUserDialog />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All users ({q.data?.length ?? 0})
          </CardTitle>
          <CardDescription>
            Super admins automatically have every permission. Toggle individual
            permissions for everyone else.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {q.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {q.data?.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              onDelete={() => {
                if (confirm(`Delete ${u.email}? This cannot be undone.`)) {
                  del.mutate({ user_id: u.id });
                }
              }}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({
  user,
  onDelete,
}: {
  user: AdminUserRow;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const fnSet = setUserPermissions;
  const [open, setOpen] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(user.is_super_admin);
  const [perms, setPerms] = useState<Set<string>>(new Set(user.permissions));

  const save = useMutation({
    mutationFn: fnSet,
    onSuccess: () => {
      toast.success("Permissions saved");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(key: string) {
    const next = new Set(perms);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setPerms(next);
  }

  return (
    <div className="rounded-md border border-border">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            {user.display_name || user.email.split("@")[0]}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {user.email}
          </div>
        </div>
        {user.is_super_admin && (
          <Badge variant="default" className="gap-1">
            <ShieldCheck className="h-3 w-3" /> Super admin
          </Badge>
        )}
        {!user.is_super_admin && (
          <Badge variant="secondary">
            {user.permissions.length} permission
            {user.permissions.length === 1 ? "" : "s"}
          </Badge>
        )}
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Edit access"}
        </Button>
        <ResetPasswordButton userId={user.id} email={user.email} />
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          title="Delete user"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      {open && (
        <div className="space-y-4 border-t border-border bg-muted/20 p-4">
          <label className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
            <div>
              <div className="text-sm font-medium">Super admin</div>
              <div className="text-xs text-muted-foreground">
                Full access including this admin area.
              </div>
            </div>
            <Switch checked={superAdmin} onCheckedChange={setSuperAdmin} />
          </label>

          <div className={superAdmin ? "pointer-events-none opacity-50" : ""}>
            {PERMISSION_GROUPS.map((grp) => (
              <div key={grp.group} className="mb-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {grp.group}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {grp.items.map((it) => (
                    <label
                      key={it.key}
                      className="flex items-start gap-2 rounded-md border border-border bg-background p-2 text-sm"
                    >
                      <Checkbox
                        checked={perms.has(it.key)}
                        onCheckedChange={() => toggle(it.key)}
                      />
                      <div className="min-w-0">
                        <div className="font-medium">{it.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {it.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  user_id: user.id,
                  is_super_admin: superAdmin,
                  permissions: Array.from(perms),
                })
              }
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save access
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResetPasswordButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const fn = resetUserPassword;
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(`Password updated for ${email}`);
      setOpen(false);
      setPw("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Reset password">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password — {email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">New password (min 8 chars)</Label>
          <Input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="e.g. Shero@2026!"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={pw.length < 8 || m.isPending}
            onClick={() => m.mutate({ user_id: userId, password: pw })}
          >
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog() {
  const qc = useQueryClient();
  const fn = createAppUser;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    display_name: "",
    is_super_admin: false,
  });
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("User created");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
      setForm({
        email: "",
        password: "",
        display_name: "",
        is_super_admin: false,
      });
      setPerms(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function toggle(k: string) {
    const next = new Set(perms);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPerms(next);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a user account</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Display name</Label>
            <Input
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Temporary password (min 8 chars)</Label>
            <Input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <label className="md:col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Super admin</div>
              <div className="text-xs text-muted-foreground">
                Full access including this admin area.
              </div>
            </div>
            <Switch
              checked={form.is_super_admin}
              onCheckedChange={(v) => setForm({ ...form, is_super_admin: v })}
            />
          </label>
          {!form.is_super_admin && (
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs">Initial permissions</Label>
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.group}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {g.items.map((it) => (
                      <label
                        key={it.key}
                        className="flex items-start gap-2 rounded-md border border-border p-2 text-sm"
                      >
                        <Checkbox
                          checked={perms.has(it.key)}
                          onCheckedChange={() => toggle(it.key)}
                        />
                        <div>
                          <div className="font-medium">{it.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {it.description}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={!form.email || form.password.length < 8 || m.isPending}
            onClick={() =>
              m.mutate({
                email: form.email,
                password: form.password,
                display_name: form.display_name || undefined,
                is_super_admin: form.is_super_admin,
                permissions: form.is_super_admin ? [] : Array.from(perms),
              })
            }
          >
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
