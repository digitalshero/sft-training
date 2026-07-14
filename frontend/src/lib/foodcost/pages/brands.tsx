import { useEffect, useState } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import type { Brand, FcStatus } from "@/lib/foodcost/types";
import { useFoodcostCountry, COUNTRY_LABEL, countryField } from "@/lib/foodcost/country";
import { BulkUpload, type BulkColumn } from "@/components/foodcost/bulk-upload";

export function StatusPill({ s }: { s: FcStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${s === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}
    >
      {s}
    </span>
  );
}

export function BrandsPage() {
  const { hasAny } = useRoles();
  const isSenior = hasAny(["admin", "super_admin"]);
  const country = useFoodcostCountry();
  const [rows, setRows] = useState<Brand[]>([]);
  const [edit, setEdit] = useState<Partial<Brand> | null>(null);

  async function load() {
    const params = country ? { [countryField(country)]: true } : {};
    const res = await api.get("/foodcost/brands", { params });
    const data = res.data;
    if ((data as any)?.error) return toast.error((data as any).error.message);
    setRows((data ?? []) as Brand[]);
  }
  useEffect(() => {
    load();
  }, [country]);

  async function save() {
    if (!edit?.name?.trim() || !edit?.code?.trim()) return toast.error("Name and code required");
    const payload = {
      name: edit.name,
      code: edit.code,
      code_prefix: edit.code_prefix?.trim() ? edit.code_prefix.trim().toUpperCase() : null,
      description: edit.description ?? null,
      status: (edit.status ?? "active") as Brand["status"],
      active_in: edit.active_in ?? true,
      active_us: edit.active_us ?? false,
      brand_since: edit.brand_since || null,
    };
    const { error } = edit.id
      ? await api.patch(`/foodcost/brands/${edit.id}`, payload).then((r) => r.data)
      : await api.post("/foodcost/brands", payload).then((r) => r.data);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEdit(null);
    load();
  }

  async function toggleCountry(b: Brand, field: "active_in" | "active_us", value: boolean) {
    const patch = { [field]: value } as Partial<Brand>;
    const { error } = await api.patch(`/foodcost/brands/${b.id}`, patch).then((r) => r.data);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, [field]: value } : r)));
  }

  type BrandRow = { name: string; code: string; description?: string; brand_since?: string };
  const brandCols: BulkColumn<BrandRow>[] = [
    { key: "name", label: "Name", required: true, example: "Acme Foods" },
    {
      key: "code",
      label: "Code",
      required: true,
      example: "ACME",
      transform: (v) => String(v ?? "").toUpperCase(),
    },
    { key: "description", label: "Description", example: "Premium spice brand" },
    {
      key: "brand_since",
      label: "Brand since (YYYY-MM-DD)",
      example: "2020-01-15",
      validate: (v) => (v && !/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? "use YYYY-MM-DD" : null),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">
          Brand Master{" "}
          {country && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — {COUNTRY_LABEL[country]}
            </span>
          )}
        </h2>
        {isSenior && (
          <div className="flex items-center gap-2">
            <BulkUpload
              entity="brands"
              columns={brandCols}
              hint="One brand per row. Code is auto-uppercased."
              onCommit={async (rows) => {
                const payload = rows.map((r) => ({
                  name: r.name,
                  code: r.code,
                  description: r.description || null,
                  brand_since: r.brand_since || null,
                  active_in: country !== "us",
                  active_us: country === "us",
                  status: "active" as const,
                }));
                const { error } = await api.post("/foodcost/brands", payload).then((r) => r.data);
                if (error) throw new Error(error.message);
                return { inserted: payload.length };
              }}
              onDone={load}
            />
            <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
              <DialogTrigger asChild>
                <Button
                  onClick={() =>
                    setEdit({
                      status: "active",
                      active_in: country !== "us",
                      active_us: country === "us",
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New brand
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{edit?.id ? "Edit brand" : "New brand"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Field label="Brand name">
                    <Input
                      value={edit?.name ?? ""}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Brand code">
                    <Input
                      value={edit?.code ?? ""}
                      onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
                    />
                  </Field>
                  <Field label="Product code prefix (short, e.g. TN)">
                    <Input
                      value={edit?.code_prefix ?? ""}
                      maxLength={4}
                      placeholder="auto from code"
                      onChange={(e) =>
                        setEdit({ ...edit, code_prefix: e.target.value.toUpperCase() })
                      }
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      value={edit?.description ?? ""}
                      onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                    />
                  </Field>
                  <Field label="Brand since">
                    <Input
                      type="date"
                      value={edit?.brand_since ?? ""}
                      onChange={(e) => setEdit({ ...edit, brand_since: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Active in India (INR)">
                      <Switch
                        checked={edit?.active_in ?? true}
                        onCheckedChange={(v) => setEdit({ ...edit, active_in: v })}
                      />
                    </Field>
                    <Field label="Active in USA (USD)">
                      <Switch
                        checked={edit?.active_us ?? false}
                        onCheckedChange={(v) => setEdit({ ...edit, active_us: v })}
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button onClick={save}>Save</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-surface-elevated">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-left">Brand since</th>
              <th className="px-4 py-2 text-left">Created</th>
              <th className="px-4 py-2 text-center">India</th>
              <th className="px-4 py-2 text-center">USA</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No brands yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.description ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground tabular-nums">
                  {r.brand_since ? new Date(r.brand_since).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground tabular-nums">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2 text-center">
                  <CountryToggle
                    active={r.active_in}
                    disabled={!isSenior}
                    onChange={(v) => toggleCountry(r, "active_in", v)}
                    label="IN"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <CountryToggle
                    active={r.active_us}
                    disabled={!isSenior}
                    onChange={(v) => toggleCountry(r, "active_us", v)}
                    label="US"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  {isSenior && (
                    <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isSenior && (
        <p className="text-xs text-muted-foreground">
          Editing brands is restricted to Admin and Super Admin roles.
        </p>
      )}
    </div>
  );
}

function CountryToggle({
  active,
  disabled,
  onChange,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40"
          : "bg-muted text-muted-foreground ring-1 ring-border"
      } ${disabled ? "cursor-not-allowed opacity-70" : "hover:brightness-110"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-muted-foreground/50"}`}
      />
      {label} · {active ? "Active" : "Inactive"}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
