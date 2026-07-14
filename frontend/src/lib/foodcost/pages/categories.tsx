import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import type {
  Category,
  Brand,
  FcStatus,
  FcPricingMode,
  PackingContainer,
} from "@/lib/foodcost/types";
import { useFoodcostCountry, COUNTRY_LABEL, countryField } from "@/lib/foodcost/country";
import { BulkUpload, type BulkColumn } from "@/components/foodcost/bulk-upload";
import { StatusPill } from "./brands";

export function CategoriesPage() {
  const { isEditor } = useRoles();
  const country = useFoodcostCountry();
  const showInr = country !== "us";
  const showUsd = country !== "in";
  const [rows, setRows] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<{ id: string; code: string }[]>([]);
  const [containers, setContainers] = useState<PackingContainer[]>([]);
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const [q, setQ] = useState("");
  const [brandF, setBrandF] = useState("all");
  const [statusF, setStatusF] = useState<"all" | FcStatus>("all");

  const filtered = rows.filter((r) => {
    if (brandF !== "all" && r.brand_id !== brandF) return false;
    if (statusF !== "all" && r.status !== statusF) return false;
    if (q && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  async function load() {
    let q = api.get("/foodcost/categories", { params: { country: country ?? undefined } });
    if (country) q = q.eq(countryField(country), true);
    let qb = api.get("/foodcost/brands", { params: { country: country ?? undefined } });
    if (country) qb = qb.eq(countryField(country), true);
    let qc = api
      .get("/foodcost/packing-containers", { params: { country: country ?? undefined } })
      .order("name");
    if (country) qc = qc.eq(countryField(country), true);
    const [c, b, u, pc] = await Promise.all([
      q,
      qb,
      api.get("/foodcost/units", { params: { country: country ?? undefined } }),
      qc,
    ]);
    if (c.error) toast.error(c.error.message);
    setRows((c.data ?? []) as Category[]);
    setBrands((b.data ?? []) as Brand[]);
    setUnits((u.data ?? []) as { id: string; code: string }[]);
    setContainers((pc.data ?? []) as PackingContainer[]);
  }
  useEffect(() => {
    load();
  }, [country]);

  async function save() {
    if (!edit?.name?.trim() || !edit?.brand_id) return toast.error("Brand and name required");
    const payload = {
      brand_id: edit.brand_id,
      name: edit.name,
      description: edit.description ?? null,
      ppp_multiplier_inr: edit.ppp_multiplier_inr ?? 2,
      mrp_multiplier_inr: edit.mrp_multiplier_inr ?? 3,
      ppp_multiplier_usd: edit.ppp_multiplier_usd ?? 2,
      mrp_multiplier_usd: edit.mrp_multiplier_usd ?? 3,
      ppp_mode: (edit.ppp_mode ?? "multiplier") as FcPricingMode,
      mrp_mode: (edit.mrp_mode ?? "multiplier") as FcPricingMode,
      ppp_flat_inr: edit.ppp_flat_inr ?? 0,
      mrp_flat_inr: edit.mrp_flat_inr ?? 0,
      ppp_flat_usd: edit.ppp_flat_usd ?? 0,
      mrp_flat_usd: edit.mrp_flat_usd ?? 0,
      ptr_mode: (edit.ptr_mode ?? "multiplier") as FcPricingMode,
      ptr_multiplier_inr: edit.ptr_multiplier_inr ?? 2.25,
      ptr_multiplier_usd: edit.ptr_multiplier_usd ?? 2.25,
      ptr_flat_inr: edit.ptr_flat_inr ?? 0,
      ptr_flat_usd: edit.ptr_flat_usd ?? 0,
      status: (edit.status ?? "active") as FcStatus,
      active_in: edit.active_in ?? country !== "us",
      active_us: edit.active_us ?? country === "us",
      veg_slot_qty: edit.veg_slot_qty ?? 100,
      veg_slot_unit_id: edit.veg_slot_unit_id ?? units.find((u) => u.code === "g")?.id ?? null,
      packing_container_id: edit.packing_container_id ?? null,
      serves_min: edit.serves_min ?? null,
      serves_max: edit.serves_max ?? null,
    };
    const { error } = edit.id
      ? await api.patch(`/foodcost/categories/${edit.id}`, payload).then((r) => r.data)
      : await api.post("/foodcost/categories", payload).then((r) => r.data);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEdit(null);
    load();
  }

  function fmtCellPpp(r: Category, ccy: "inr" | "usd") {
    return r.ppp_mode === "flat"
      ? `+${ccy === "inr" ? "₹" : "$"}${Number(ccy === "inr" ? r.ppp_flat_inr : r.ppp_flat_usd).toFixed(2)}`
      : `${Number(ccy === "inr" ? r.ppp_multiplier_inr : r.ppp_multiplier_usd)}×`;
  }
  function fmtCellMrp(r: Category, ccy: "inr" | "usd") {
    return r.mrp_mode === "flat"
      ? `+${ccy === "inr" ? "₹" : "$"}${Number(ccy === "inr" ? r.mrp_flat_inr : r.mrp_flat_usd).toFixed(2)}`
      : `${Number(ccy === "inr" ? r.mrp_multiplier_inr : r.mrp_multiplier_usd)}×`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-semibold mr-auto">
          Category Master{" "}
          {country && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — {COUNTRY_LABEL[country]}
            </span>
          )}
        </h2>
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        <Select value={brandF} onValueChange={setBrandF}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusF} onValueChange={(v) => setStatusF(v as "all" | FcStatus)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {isEditor && <CategoryBulk brands={brands} country={country} onDone={load} />}
        {isEditor && (
          <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
            <DialogTrigger asChild>
              <Button
                onClick={() =>
                  setEdit({
                    status: "active",
                    ppp_mode: "multiplier",
                    mrp_mode: "multiplier",
                    ppp_multiplier_inr: 2,
                    mrp_multiplier_inr: 3,
                    ppp_multiplier_usd: 2,
                    mrp_multiplier_usd: 3,
                    ppp_flat_inr: 0,
                    mrp_flat_inr: 0,
                    ppp_flat_usd: 0,
                    mrp_flat_usd: 0,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                New category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{edit?.id ? "Edit category" : "New category"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Brand">
                  <Select
                    value={edit?.brand_id ?? ""}
                    onValueChange={(v) => setEdit({ ...edit, brand_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Category name">
                  <Input
                    value={edit?.name ?? ""}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  />
                </Field>
                <div className="col-span-2">
                  <Field label="Description">
                    <Textarea
                      value={edit?.description ?? ""}
                      onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                    />
                  </Field>
                </div>

                <Field label="PPP mode">
                  <Select
                    value={edit?.ppp_mode ?? "multiplier"}
                    onValueChange={(v) => setEdit({ ...edit, ppp_mode: v as FcPricingMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiplier">Multiplier (× cost)</SelectItem>
                      <SelectItem value="flat">Flat (+ amount)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="MRP mode">
                  <Select
                    value={edit?.mrp_mode ?? "multiplier"}
                    onValueChange={(v) => setEdit({ ...edit, mrp_mode: v as FcPricingMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiplier">Multiplier (× PPP)</SelectItem>
                      <SelectItem value="flat">Flat (+ amount)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {showInr && (edit?.ppp_mode ?? "multiplier") === "multiplier" && (
                  <Field label="PPP × INR">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.ppp_multiplier_inr ?? 2}
                      onChange={(e) =>
                        setEdit({ ...edit, ppp_multiplier_inr: Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
                {showInr && (edit?.ppp_mode ?? "multiplier") === "flat" && (
                  <Field label="PPP + ₹ flat">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.ppp_flat_inr ?? 0}
                      onChange={(e) => setEdit({ ...edit, ppp_flat_inr: Number(e.target.value) })}
                    />
                  </Field>
                )}
                {showInr && (edit?.mrp_mode ?? "multiplier") === "multiplier" && (
                  <Field label="MRP × INR">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.mrp_multiplier_inr ?? 3}
                      onChange={(e) =>
                        setEdit({ ...edit, mrp_multiplier_inr: Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
                {showInr && (edit?.mrp_mode ?? "multiplier") === "flat" && (
                  <Field label="MRP + ₹ flat">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.mrp_flat_inr ?? 0}
                      onChange={(e) => setEdit({ ...edit, mrp_flat_inr: Number(e.target.value) })}
                    />
                  </Field>
                )}

                {showUsd && (edit?.ppp_mode ?? "multiplier") === "multiplier" && (
                  <Field label="PPP × USD">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.ppp_multiplier_usd ?? 2}
                      onChange={(e) =>
                        setEdit({ ...edit, ppp_multiplier_usd: Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
                {showUsd && (edit?.ppp_mode ?? "multiplier") === "flat" && (
                  <Field label="PPP + $ flat">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.ppp_flat_usd ?? 0}
                      onChange={(e) => setEdit({ ...edit, ppp_flat_usd: Number(e.target.value) })}
                    />
                  </Field>
                )}
                {showUsd && (edit?.mrp_mode ?? "multiplier") === "multiplier" && (
                  <Field label="MRP × USD">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.mrp_multiplier_usd ?? 3}
                      onChange={(e) =>
                        setEdit({ ...edit, mrp_multiplier_usd: Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
                {showUsd && (edit?.mrp_mode ?? "multiplier") === "flat" && (
                  <Field label="MRP + $ flat">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.mrp_flat_usd ?? 0}
                      onChange={(e) => setEdit({ ...edit, mrp_flat_usd: Number(e.target.value) })}
                    />
                  </Field>
                )}

                <div className="col-span-2 border-t border-border pt-3 mt-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    PTR (Price To Retailer)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="PTR mode">
                      <Select
                        value={edit?.ptr_mode ?? "multiplier"}
                        onValueChange={(v) => setEdit({ ...edit, ptr_mode: v as FcPricingMode })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiplier">Multiplier (× FC)</SelectItem>
                          <SelectItem value="flat">Flat (+ amount)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div />
                    {showInr && (edit?.ptr_mode ?? "multiplier") === "multiplier" && (
                      <Field label="PTR × INR">
                        <Input
                          type="number"
                          step="0.01"
                          value={edit?.ptr_multiplier_inr ?? 2.25}
                          onChange={(e) =>
                            setEdit({ ...edit, ptr_multiplier_inr: Number(e.target.value) })
                          }
                        />
                      </Field>
                    )}
                    {showInr && (edit?.ptr_mode ?? "multiplier") === "flat" && (
                      <Field label="PTR ₹ flat">
                        <Input
                          type="number"
                          step="0.01"
                          value={edit?.ptr_flat_inr ?? 0}
                          onChange={(e) =>
                            setEdit({ ...edit, ptr_flat_inr: Number(e.target.value) })
                          }
                        />
                      </Field>
                    )}
                    {showUsd && (edit?.ptr_mode ?? "multiplier") === "multiplier" && (
                      <Field label="PTR × USD">
                        <Input
                          type="number"
                          step="0.01"
                          value={edit?.ptr_multiplier_usd ?? 2.25}
                          onChange={(e) =>
                            setEdit({ ...edit, ptr_multiplier_usd: Number(e.target.value) })
                          }
                        />
                      </Field>
                    )}
                    {showUsd && (edit?.ptr_mode ?? "multiplier") === "flat" && (
                      <Field label="PTR $ flat">
                        <Input
                          type="number"
                          step="0.01"
                          value={edit?.ptr_flat_usd ?? 0}
                          onChange={(e) =>
                            setEdit({ ...edit, ptr_flat_usd: Number(e.target.value) })
                          }
                        />
                      </Field>
                    )}
                  </div>
                </div>

                <div className="col-span-2 border-t border-border pt-3 mt-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Vegetable slot (CRC)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Slot qty (e.g. 100)">
                      <Input
                        type="number"
                        step="0.01"
                        value={edit?.veg_slot_qty ?? 100}
                        onChange={(e) => setEdit({ ...edit, veg_slot_qty: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Slot unit">
                      <Select
                        value={
                          edit?.veg_slot_unit_id ?? units.find((u) => u.code === "g")?.id ?? ""
                        }
                        onValueChange={(v) => setEdit({ ...edit, veg_slot_unit_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="g" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
                <div className="col-span-2 border-t border-border pt-3 mt-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Packing container (added on top of PTR)
                  </div>
                  <Field label="Container">
                    <Select
                      value={edit?.packing_container_id ?? "none"}
                      onValueChange={(v) =>
                        setEdit({ ...edit, packing_container_id: v === "none" ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select container" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {containers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                            {c.size_qty
                              ? ` (${c.size_qty} ${units.find((u) => u.id === c.size_unit_id)?.code ?? ""})`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {edit?.packing_container_id &&
                    (() => {
                      const c = containers.find((x) => x.id === edit.packing_container_id);
                      if (!c) return null;
                      return (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Packing cost: {showInr && <>₹{Number(c.price_inr).toFixed(2)}</>}
                          {showInr && showUsd && " / "}
                          {showUsd && <>${Number(c.price_usd).toFixed(2)}</>}
                        </div>
                      );
                    })()}
                  <div className="mt-3">
                    <Field label="Serves">
                      <Input
                        type="text"
                        placeholder="e.g. 1-2 or 3"
                        defaultValue={
                          edit?.serves_min == null
                            ? ""
                            : edit?.serves_max && edit.serves_max !== edit.serves_min
                              ? `${edit.serves_min}-${edit.serves_max}`
                              : `${edit.serves_min}`
                        }
                        key={edit?.id ?? "new"}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (v === "") {
                            setEdit({ ...edit, serves_min: null, serves_max: null });
                            return;
                          }
                          const m = v.match(/^(\d+)\s*(?:[-–to]+\s*(\d+))?$/i);
                          if (!m) return;
                          const mn = Number(m[1]);
                          const mx = m[2] ? Number(m[2]) : null;
                          setEdit({ ...edit, serves_min: mn, serves_max: mx });
                        }}
                      />
                    </Field>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Locked to this pack size. Shown on menu as "Serves {edit?.serves_min ?? "—"}
                    {edit?.serves_max && edit.serves_max !== edit.serves_min
                      ? `–${edit.serves_max}`
                      : ""}
                    ".
                  </div>
                </div>
                <Field label="Status">
                  <Select
                    value={edit?.status ?? "active"}
                    onValueChange={(v) => setEdit({ ...edit, status: v as FcStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button onClick={save}>Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-surface-elevated">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Brand</th>
              <th className="px-4 py-2 text-left">Category</th>
              {showInr && <th className="px-4 py-2 text-right">PPP (INR)</th>}
              {showInr && <th className="px-4 py-2 text-right">MRP (INR)</th>}
              {showUsd && <th className="px-4 py-2 text-right">PPP (USD)</th>}
              {showUsd && <th className="px-4 py-2 text-right">MRP (USD)</th>}
              <th className="px-4 py-2">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No categories.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2 text-muted-foreground">
                  {brands.find((b) => b.id === r.brand_id)?.name ?? "—"}
                </td>
                <td className="px-4 py-2 font-medium">{r.name}</td>
                {showInr && (
                  <td className="px-4 py-2 text-right tabular-nums">{fmtCellPpp(r, "inr")}</td>
                )}
                {showInr && (
                  <td className="px-4 py-2 text-right tabular-nums">{fmtCellMrp(r, "inr")}</td>
                )}
                {showUsd && (
                  <td className="px-4 py-2 text-right tabular-nums">{fmtCellPpp(r, "usd")}</td>
                )}
                {showUsd && (
                  <td className="px-4 py-2 text-right tabular-nums">{fmtCellMrp(r, "usd")}</td>
                )}
                <td className="px-4 py-2">
                  {isEditor ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.status === "active"}
                        onCheckedChange={async (on) => {
                          const next: FcStatus = on ? "active" : "inactive";
                          setRows((rs) =>
                            rs.map((x) => (x.id === r.id ? { ...x, status: next } : x)),
                          );
                          const { error } = await api
                            .patch(`/foodcost/categories/${r.id}`, { status: next })
                            .then((r) => r.data);
                          if (error) {
                            toast.error(error.message);
                            load();
                          } else toast.success(on ? "Activated" : "Suspended");
                        }}
                      />
                      <StatusPill s={r.status} />
                    </div>
                  ) : (
                    <StatusPill s={r.status} />
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    to="/foodcost/categories/$id/crc"
                    params={{ id: r.id }}
                    className="mr-2 text-xs font-medium text-primary hover:underline"
                  >
                    Open card →
                  </Link>
                  {isEditor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEdit(r)}
                      title="Quick edit (brand, pricing, packing)"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  {isEditor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      title="Delete category"
                      onClick={async () => {
                        if (
                          !confirm(
                            `Delete category "${r.name}"? Products in this category must be reassigned or deleted first.`,
                          )
                        )
                          return;
                        const { error } = await api
                          .delete(`/foodcost/categories/${r.id}`)
                          .then((r) => r.data);
                        if (error) return toast.error(error.message);
                        toast.success("Deleted");
                        load();
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

type CatBulkRow = {
  brand_code: string;
  name: string;
  description?: string;
  ppp_mode?: string;
  ppp_value?: number;
  mrp_mode?: string;
  mrp_value?: number;
};
function CategoryBulk({
  brands,
  country,
  onDone,
}: {
  brands: Brand[];
  country: ReturnType<typeof useFoodcostCountry>;
  onDone: () => void;
}) {
  const brandByCode = new Map(brands.map((b) => [b.code.toUpperCase(), b]));
  const ccy = country === "us" ? "usd" : "inr";
  const cols: BulkColumn<CatBulkRow>[] = [
    {
      key: "brand_code",
      label: "Brand code",
      required: true,
      example: brands[0]?.code ?? "ACME",
      transform: (v) => String(v ?? "").toUpperCase(),
      validate: (v) => (brandByCode.has(String(v)) ? null : "unknown brand code"),
    },
    { key: "name", label: "Category name", required: true, example: "Sauces" },
    { key: "description", label: "Description", example: "" },
    {
      key: "ppp_mode",
      label: "PPP mode (multiplier|flat)",
      example: "multiplier",
      validate: (v) =>
        !v || ["multiplier", "flat"].includes(String(v)) ? null : "use multiplier or flat",
    },
    { key: "ppp_value", label: `PPP value (× or +${ccy.toUpperCase()})`, example: 2 },
    {
      key: "mrp_mode",
      label: "MRP mode (multiplier|flat)",
      example: "multiplier",
      validate: (v) =>
        !v || ["multiplier", "flat"].includes(String(v)) ? null : "use multiplier or flat",
    },
    { key: "mrp_value", label: `MRP value (× or +${ccy.toUpperCase()})`, example: 3 },
  ];
  return (
    <BulkUpload
      entity="categories"
      columns={cols}
      hint="PPP/MRP value is applied to the active country currency."
      onCommit={async (rows) => {
        const payload = rows.map((r) => {
          const pppMode = (r.ppp_mode || "multiplier") as "multiplier" | "flat";
          const mrpMode = (r.mrp_mode || "multiplier") as "multiplier" | "flat";
          const pppV = Number(r.ppp_value ?? (pppMode === "multiplier" ? 2 : 0));
          const mrpV = Number(r.mrp_value ?? (mrpMode === "multiplier" ? 3 : 0));
          return {
            brand_id: brandByCode.get(r.brand_code)!.id,
            name: r.name,
            description: r.description || null,
            ppp_mode: pppMode,
            mrp_mode: mrpMode,
            ppp_multiplier_inr: ccy === "inr" && pppMode === "multiplier" ? pppV : 2,
            mrp_multiplier_inr: ccy === "inr" && mrpMode === "multiplier" ? mrpV : 3,
            ppp_multiplier_usd: ccy === "usd" && pppMode === "multiplier" ? pppV : 2,
            mrp_multiplier_usd: ccy === "usd" && mrpMode === "multiplier" ? mrpV : 3,
            ppp_flat_inr: ccy === "inr" && pppMode === "flat" ? pppV : 0,
            mrp_flat_inr: ccy === "inr" && mrpMode === "flat" ? mrpV : 0,
            ppp_flat_usd: ccy === "usd" && pppMode === "flat" ? pppV : 0,
            mrp_flat_usd: ccy === "usd" && mrpMode === "flat" ? mrpV : 0,
            status: "active" as FcStatus,
            active_in: country !== "us",
            active_us: country === "us",
          };
        });
        const { error } = await api.post("/foodcost/categories", payload).then((r) => r.data);
        if (error) throw new Error(error.message);
        return { inserted: payload.length };
      }}
      onDone={onDone}
    />
  );
}
