import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useRoles } from "@/lib/use-roles";
import type { PackingContainer, FcStatus, Unit } from "@/lib/foodcost/types";
import { useFoodcostCountry, COUNTRY_LABEL, countryField } from "@/lib/foodcost/country";
import { uploadToStorage, getSignedUrl } from "@/lib/api/storage";
import { StatusPill } from "./brands";

export function PackingContainersPage() {
  const { isEditor } = useRoles();
  const country = useFoodcostCountry();
  const showInr = country !== "us";
  const showUsd = country !== "in";
  const [rows, setRows] = useState<PackingContainer[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [usage, setUsage] = useState<Map<string, string[]>>(new Map());
  const [edit, setEdit] = useState<Partial<PackingContainer> | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    const activeField = country ? countryField(country) : null;
    const [pRes, uRes, cRes] = await Promise.all([
      api.get("/foodcost/packing-containers", { params: { country: country ?? undefined } }),
      api.get("/foodcost/units", { params: { country: country ?? undefined } }),
      api.get("/foodcost/categories", { params: { country: country ?? undefined } }),
    ]);
    const pRows = (pRes.data ?? []) as PackingContainer[];
    const rows = activeField
      ? pRows.filter((row) => (row as Record<string, unknown>)[activeField] === true)
      : pRows;
    setRows(rows);
    setUnits((uRes.data ?? []) as Unit[]);
    const m = new Map<string, string[]>();
    const categories = (cRes.data ?? []) as { name: string; packing_container_id: string }[];
    for (const cat of categories.filter((row) => !!row.packing_container_id)) {
      const arr = m.get(cat.packing_container_id) ?? [];
      arr.push(cat.name);
      m.set(cat.packing_container_id, arr);
    }
    setUsage(m);
  }
  useEffect(() => {
    load();
  }, [country]);

  const filtered = useMemo(
    () => rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())),
    [rows, q],
  );

  async function save() {
    if (!edit?.name?.trim()) return toast.error("Name required");
    const payload = {
      name: edit.name.trim(),
      size_qty: Number(edit.size_qty ?? 0),
      size_unit_id: edit.size_unit_id ?? units.find((u) => u.code === "ml")?.id ?? null,
      price_inr: Number(edit.price_inr ?? 0),
      price_usd: Number(edit.price_usd ?? 0),
      status: (edit.status ?? "active") as FcStatus,
      active_in: edit.active_in ?? country !== "us",
      active_us: edit.active_us ?? country === "us",
      image_url: edit.image_url ?? null,
    };
    const { error } = edit.id
      ? await api.patch(`/foodcost/packing-containers/${edit.id}`, payload).then((r) => r.data)
      : await api.post("/foodcost/packing-containers", payload).then((r) => r.data);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEdit(null);
    load();
  }

  async function uploadContainerImage(file: File) {
    if (!edit) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `packing/${edit.id ?? "new"}-${Date.now()}.${ext}`;
    const uploadError = await uploadToStorage("learning-media", path, file);
    if (uploadError) return toast.error(uploadError);
    const url = await getSignedUrl("learning-media", path);
    if (!url) return toast.error("Unable to create image URL");
    setEdit({ ...edit, image_url: url });
    toast.success("Image attached — click Save");
  }

  const sizeUnits = units.filter((u) =>
    ["ml", "l", "fl_oz", "g", "kg", "oz", "lb", "pcs", "packet"].includes(u.code),
  );

  const US_EQUIVALENTS: [string, string, string][] = [
    ["100 ml", "3.4 fl oz", "4 oz container / small sauce cup"],
    ["250 ml", "8.45 fl oz", "8 oz container"],
    ["450 ml", "15.2 fl oz", "16 oz container / 1 pint deli container"],
    ["750 ml", "25.36 fl oz", "24 oz or 26 oz container"],
    ["1 liter / 1000 ml", "33.8 fl oz", "32 oz container / 1 quart container"],
  ];

  async function fetchImageDataUrl(
    url: string,
  ): Promise<{ data: string; w: number; h: number } | null> {
    try {
      const res = await fetch(url, { mode: "cors" });
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.width, h: img.height });
        img.onerror = () => resolve({ w: 1, h: 1 });
        img.src = dataUrl;
      });
      return { data: dataUrl, w: dims.w, h: dims.h };
    } catch {
      return null;
    }
  }

  async function downloadPdf() {
    toast.info("Preparing PDF…");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = `Packing Containers${country ? ` — ${COUNTRY_LABEL[country]}` : ""}`;
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(new Date().toLocaleString(), 40, 56);
    doc.setTextColor(0);

    const ROW_H = 56;
    const IMG = 44;
    const images = await Promise.all(
      filtered.map((r) => (r.image_url ? fetchImageDataUrl(r.image_url) : Promise.resolve(null))),
    );

    autoTable(doc, {
      startY: 72,
      head: [["Picture", "Name", "Size", "Used in"]],
      body: filtered.map((r) => {
        const sz = r.size_qty
          ? `${r.size_qty} ${units.find((u) => u.id === r.size_unit_id)?.code ?? ""}`
          : "—";
        const cats = usage.get(r.id) ?? [];
        return ["", r.name, sz, cats.length ? cats.join(", ") : "—"];
      }),
      styles: { fontSize: 9, cellPadding: 6, valign: "middle", minCellHeight: ROW_H },
      headStyles: { fillColor: [20, 20, 20] },
      columnStyles: { 0: { cellWidth: IMG + 12 }, 1: { cellWidth: 160 }, 2: { cellWidth: 80 } },
      margin: { left: 24, right: 24 },
      didDrawCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const img = images[data.row.index];
          if (img) {
            const ratio = img.w / img.h || 1;
            let w = IMG,
              h = IMG;
            if (ratio > 1) h = IMG / ratio;
            else w = IMG * ratio;
            const x = data.cell.x + (data.cell.width - w) / 2;
            const y = data.cell.y + (data.cell.height - h) / 2;
            try {
              doc.addImage(img.data, x, y, w, h);
            } catch {
              /* ignore */
            }
          }
        }
      },
    });

    const afterY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;
    doc.setFontSize(13);
    doc.text("US equivalents for food container sizes", 40, afterY);
    autoTable(doc, {
      startY: afterY + 10,
      head: [["India / Metric Size", "US Equivalent", "Practical US Container Name"]],
      body: US_EQUIVALENTS,
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [20, 20, 20] },
      margin: { left: 24, right: 24 },
    });

    doc.save(`packing-containers${country ? `-${country}` : ""}.pdf`);
    toast.success("PDF downloaded");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="font-display text-lg font-semibold">
            Packing Containers
            {country && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — {COUNTRY_LABEL[country]}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            Reusable containers (tubs, cups, lids…) linked from each category.
          </p>
        </div>
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-56"
        />
        <Button variant="outline" onClick={downloadPdf}>
          <FileDown className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
        {isEditor && (
          <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
            <DialogTrigger asChild>
              <Button
                onClick={() =>
                  setEdit({
                    status: "active",
                    size_qty: 0,
                    price_inr: 0,
                    price_usd: 0,
                    active_in: country !== "us",
                    active_us: country === "us",
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                New container
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{edit?.id ? "Edit container" : "New container"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="Name">
                    <Input
                      value={edit?.name ?? ""}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      placeholder="450 ml Tub"
                    />
                  </Field>
                </div>
                <Field label="Size">
                  <Input
                    type="number"
                    step="0.01"
                    value={edit?.size_qty ?? 0}
                    onChange={(e) => setEdit({ ...edit, size_qty: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Unit">
                  <Select
                    value={edit?.size_unit_id ?? sizeUnits.find((u) => u.code === "ml")?.id ?? ""}
                    onValueChange={(v) => setEdit({ ...edit, size_unit_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="ml" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizeUnits.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {showInr && (
                  <Field label="Price ₹">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.price_inr ?? 0}
                      onChange={(e) => setEdit({ ...edit, price_inr: Number(e.target.value) })}
                    />
                  </Field>
                )}
                {showUsd && (
                  <Field label="Price $">
                    <Input
                      type="number"
                      step="0.01"
                      value={edit?.price_usd ?? 0}
                      onChange={(e) => setEdit({ ...edit, price_usd: Number(e.target.value) })}
                    />
                  </Field>
                )}
                <Field label="Active in India">
                  <div className="pt-2">
                    <Switch
                      checked={edit?.active_in ?? false}
                      onCheckedChange={(v) => setEdit({ ...edit, active_in: v })}
                    />
                  </div>
                </Field>
                <Field label="Active in USA">
                  <div className="pt-2">
                    <Switch
                      checked={edit?.active_us ?? false}
                      onCheckedChange={(v) => setEdit({ ...edit, active_us: v })}
                    />
                  </div>
                </Field>
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
                <div className="col-span-2">
                  <Field label="Image">
                    <div className="flex items-center gap-3">
                      {edit?.image_url ? (
                        <img
                          src={edit.image_url}
                          alt=""
                          className="h-16 w-16 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border border-dashed border-border bg-muted" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          e.target.files?.[0] && uploadContainerImage(e.target.files[0])
                        }
                        className="text-xs"
                      />
                    </div>
                  </Field>
                </div>
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
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-right">Size</th>
              {showInr && <th className="px-4 py-2 text-right">Price ₹</th>}
              {showUsd && <th className="px-4 py-2 text-right">Price $</th>}
              <th className="px-4 py-2 text-left">Used in</th>
              <th className="px-4 py-2">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No containers yet.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const cats = usage.get(r.id) ?? [];
              return (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">
                    {r.size_qty
                      ? `${r.size_qty} ${units.find((u) => u.id === r.size_unit_id)?.code ?? ""}`
                      : "—"}
                  </td>
                  {showInr && (
                    <td className="px-4 py-2 text-right tabular-nums">
                      ₹{Number(r.price_inr).toFixed(2)}
                    </td>
                  )}
                  {showUsd && (
                    <td className="px-4 py-2 text-right tabular-nums">
                      ${Number(r.price_usd).toFixed(2)}
                    </td>
                  )}
                  <td className="px-4 py-2 text-xs">
                    {cats.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1" title={cats.join(", ")}>
                        {cats.slice(0, 3).map((n) => (
                          <span key={n} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                            {n}
                          </span>
                        ))}
                        {cats.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{cats.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill s={r.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isEditor && (
                      <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {isEditor && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          if (
                            !confirm(`Delete packing container "${r.name}"? This cannot be undone.`)
                          )
                            return;
                          const { error } = await api
                            .delete(`/foodcost/packing-containers/${r.id}`)
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-surface-elevated p-4">
        <h3 className="font-display text-sm font-semibold">
          US equivalents for food container sizes
        </h3>
        <p className="text-xs text-muted-foreground">
          Reference chart — handy when matching India metric sizes to US packaging.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">India / Metric Size</th>
                <th className="px-3 py-2 text-left">US Equivalent</th>
                <th className="px-3 py-2 text-left">Practical US Container Name</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["100 ml", "3.4 fl oz", "4 oz container / small sauce cup"],
                ["250 ml", "8.45 fl oz", "8 oz container"],
                ["450 ml", "15.2 fl oz", "16 oz container / 1 pint deli container"],
                ["750 ml", "25.36 fl oz", "24 oz or 26 oz container"],
                ["1 liter / 1000 ml", "33.8 fl oz", "32 oz container / 1 quart container"],
              ].map(([m, u, n]) => (
                <tr key={m} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-medium">{m}</td>
                  <td className="px-3 py-2 tabular-nums">{u}</td>
                  <td className="px-3 py-2 text-muted-foreground">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
