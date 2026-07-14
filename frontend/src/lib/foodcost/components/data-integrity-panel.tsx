import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import api from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Health = {
  orphans: Array<{
    product_id: string;
    code: string;
    name: string;
    category_id: string;
    category_name: string;
    cat_status: string;
    cat_active: boolean;
  }>;
  drift_categories: Array<{ id: string; name: string; status: string; active: boolean }>;
  drift_products: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    active: boolean;
  }>;
  veg_incomplete: Array<{ product_id: string; code: string; name: string; category_name: string }>;
};

export function DataIntegrityPanel({ country }: { country: "in" | "us" }) {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.post("/foodcost/rpc/fc-data-health", {
        _country: country,
      });
      setData(res.data as Health);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load health data");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [country]);

  async function syncDriftFlags() {
    if (!data) return;
    setBusy(true);
    const isIn = country === "in";
    try {
      for (const c of data.drift_categories) {
        const patch = isIn
          ? { active_in: c.status === "active" }
          : { active_us: c.status === "active" };
        await api.patch(`/foodcost/categories/${c.id}`, patch).then((r) => r.data);
      }
      for (const p of data.drift_products) {
        const patch = isIn
          ? { active_in: p.status === "active" }
          : { active_us: p.status === "active" };
        await api.patch(`/foodcost/products/${p.id}`, patch).then((r) => r.data);
      }
      toast.success("Country flags synced to status");
      await load();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function fixVegMode(productId: string) {
    setBusy(true);
    try {
      await api.patch(`/foodcost/products/${productId}`, { veg_mode: "none" });
      toast.success("Set to 'none'");
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update veg mode");
    } finally {
      setBusy(false);
    }
  }

  const orphans = data?.orphans ?? [];
  const driftC = data?.drift_categories ?? [];
  const driftP = data?.drift_products ?? [];
  const veg = data?.veg_incomplete ?? [];
  const total = orphans.length + driftC.length + driftP.length + veg.length;

  return (
    <div className="rounded-2xl border border-border bg-surface-elevated overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-muted/30"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-display font-semibold">Data Integrity</span>
        {total === 0 ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Clean
          </Badge>
        ) : (
          <Badge variant="secondary">
            {total} issue{total === 1 ? "" : "s"}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground">
          Orphans {orphans.length} · Flag drift {driftC.length + driftP.length} · Veg incomplete{" "}
          {veg.length}
        </span>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="ml-auto h-7"
          onClick={(e) => {
            e.stopPropagation();
            load();
          }}
          disabled={loading}
        >
          <span>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </span>
        </Button>
      </button>

      {open && data && (
        <div className="space-y-4 border-t border-border p-4">
          {/* Orphans */}
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Orphan products <span className="text-foreground">({orphans.length})</span>
            </h3>
            {orphans.length === 0 ? (
              <p className="text-xs text-muted-foreground">None 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Cat status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphans.map((o) => (
                    <TableRow key={o.product_id}>
                      <TableCell className="font-mono text-xs">{o.code}</TableCell>
                      <TableCell>{o.name}</TableCell>
                      <TableCell>{o.category_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {o.cat_status} / {o.cat_active ? "on" : "off"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to="/foodcost/categories/$id/crc"
                          params={{ id: o.category_id }}
                          className="text-primary hover:underline text-xs"
                        >
                          Open category →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {/* Flag drift */}
          <section>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Flag drift{" "}
                <span className="text-foreground">({driftC.length + driftP.length})</span>
              </h3>
              {driftC.length + driftP.length > 0 && (
                <Button size="sm" variant="outline" onClick={syncDriftFlags} disabled={busy}>
                  Sync all flags to status
                </Button>
              )}
            </div>
            {driftC.length + driftP.length === 0 ? (
              <p className="text-xs text-muted-foreground">None 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active ({country.toUpperCase()})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driftC.map((c) => (
                    <TableRow key={`c-${c.id}`}>
                      <TableCell>
                        <Badge variant="outline">category</Badge>
                      </TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.status}</TableCell>
                      <TableCell>{c.active ? "on" : "off"}</TableCell>
                    </TableRow>
                  ))}
                  {driftP.map((p) => (
                    <TableRow key={`p-${p.id}`}>
                      <TableCell>
                        <Badge variant="outline">product</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>{p.active ? "on" : "off"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          {/* Veg incomplete */}
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Veg incomplete <span className="text-foreground">({veg.length})</span>
            </h3>
            {veg.length === 0 ? (
              <p className="text-xs text-muted-foreground">None 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veg.map((v) => (
                    <TableRow key={v.product_id}>
                      <TableCell className="font-mono text-xs">{v.code}</TableCell>
                      <TableCell>{v.name}</TableCell>
                      <TableCell>{v.category_name}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link
                          to={`/foodcost/${country}/products`}
                          className="text-xs text-primary hover:underline"
                        >
                          Edit →
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fixVegMode(v.product_id)}
                          disabled={busy}
                        >
                          Set "none"
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
