import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileDown } from "lucide-react";
import { toast } from "sonner";

import { fmt, type FcCurrency } from "@/lib/foodcost/types";
import { exportCSV } from "@/lib/export";

type PL = {
  id: string;
  name: string;
  currency: FcCurrency;
  status: string;
  notes: string | null;
  generated_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  reviewed_at: string | null;
};

type Item = {
  id: string;
  kind: "ingredient" | "recipe";
  ref_id: string;
  name: string;
  meta: Record<string, unknown> | null;
  unit_code: string | null;
  unit_price: number;
  ppp_price: number | null;
  packing_price: number | null;
  total_price: number | null;
  mrp_price: number | null;
  position: number;
};

type PreviousSnapshot = {
  id: string;
  name: string;
  generated_at: string;
};

type DiffStatus = "added" | "removed" | "changed" | "active";

type ProductRow = {
  id: string;
  change: DiffStatus;
  changeLabel: string;
  name: string;
  category: string;
  fc: string;
  ptrRule: string;
  ptr: string;
  packing: string;
  total: string;
  mrpRule: string;
  selling: string;
  position: number;
};

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/15 text-blue-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

const CHANGE_LABEL: Record<DiffStatus, string> = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
  active: "Active",
};

function nearlyEqual(a: number | null | undefined, b: number | null | undefined) {
  const x = a == null ? null : Number(a);
  const y = b == null ? null : Number(b);
  if (x == null && y == null) return true;
  if (x == null || y == null) return false;
  return Math.abs(x - y) < 0.005;
}

export function PriceListDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const [pl, setPl] = useState<PL | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [previous, setPrevious] = useState<PreviousSnapshot | null>(null);
  const [previousItems, setPreviousItems] = useState<Item[]>([]);

  async function load() {
    try {
      const priceListRes = await api.get(`/foodcost/price-lists/${id}`);
      const current = (priceListRes.data ?? null) as PL | null;
      setPl(current);
      if (!current) {
        setItems([]);
        setPrevious(null);
        setPreviousItems([]);
        return;
      }

      const [itemRes, previousRes] = await Promise.all([
        api.get("/foodcost/fc-price-list-items"),
        api.get("/foodcost/fc-price-lists"),
      ]);

      setItems((itemRes.data ?? []) as Item[]);
      const prev = (previousRes.data ?? null) as PreviousSnapshot | null;
      setPrevious(prev);

      if (!prev) {
        setPreviousItems([]);
        return;
      }

      const previousItemsRes = await api.get("/foodcost/fc-price-list-items");
      setPreviousItems((previousItemsRes.data ?? []) as Item[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load price list");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);


  const productRows = useMemo<ProductRow[]>(() => {
    if (!pl) return [];

    const toRow = (item: Item, change: DiffStatus, fallbackPosition: number): ProductRow => {
      const meta = (item.meta ?? {}) as { category?: string; ppp_rule?: string; mrp_rule?: string };
      return {
        id: `${change}-${item.ref_id}`,
        change,
        changeLabel: CHANGE_LABEL[change],
        name: item.name,
        category: meta.category ?? "—",
        fc: fmt(Number(item.unit_price), pl.currency),
        ptrRule: meta.ppp_rule ?? "—",
        ptr: item.ppp_price != null ? fmt(Number(item.ppp_price), pl.currency) : "—",
        packing: item.packing_price != null ? fmt(Number(item.packing_price), pl.currency) : "—",
        total: item.total_price != null ? fmt(Number(item.total_price), pl.currency) : "—",
        mrpRule: meta.mrp_rule ?? "—",
        selling: item.mrp_price != null ? fmt(Number(item.mrp_price), pl.currency) : "—",
        position: item.position ?? fallbackPosition,
      };
    };

    const previousMap = new Map(previousItems.map((item) => [item.ref_id, item]));
    const currentMap = new Map(items.map((item) => [item.ref_id, item]));

    const activeRows = items.map((item, index) => {
      let change: DiffStatus;
      if (!previous) {
        change = "active";
      } else {
        const prev = previousMap.get(item.ref_id);
        if (!prev) {
          change = "added";
        } else if (
          !nearlyEqual(item.unit_price, prev.unit_price) ||
          !nearlyEqual(item.ppp_price, prev.ppp_price) ||
          !nearlyEqual(item.packing_price, prev.packing_price) ||
          !nearlyEqual(item.total_price, prev.total_price) ||
          !nearlyEqual(item.mrp_price, prev.mrp_price)
        ) {
          change = "changed";
        } else {
          change = "active";
        }
      }
      return toRow(item, change, index);
    });

    const removedRows = previousItems
      .filter((item) => !currentMap.has(item.ref_id))
      .map((item, index) => toRow(item, "removed", items.length + index))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Sort: Added first, then Changed, then Active, then Removed
    const order: Record<DiffStatus, number> = { added: 0, changed: 1, active: 2, removed: 3 };
    return [...activeRows, ...removedRows].sort((a, b) => {
      const d = order[a.change] - order[b.change];
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
  }, [items, previousItems, pl, previous]);

  function exportRows() {
    return productRows.map((row) => ({
      status: row.changeLabel,
      product: row.name,
      category: row.category,
      fc: row.fc,
      ptrRule: row.ptrRule,
      ptr: row.ptr,
      packing: row.packing,
      total: row.total,
      mrpRule: row.mrpRule,
      selling: row.selling,
      change: row.change,
    }));
  }

  const exportCols = [
    { key: "status", label: "Status" },
    { key: "product", label: "Product" },
    { key: "category", label: "Category" },
    { key: "fc", label: "FC" },
    { key: "ptrRule", label: "PTR Rule" },
    { key: "ptr", label: "PTR" },
    { key: "packing", label: "Packing" },
    { key: "total", label: "Total" },
    { key: "mrpRule", label: "Selling Rule" },
    { key: "selling", label: "Selling Price" },
  ];

  function downloadCSV() {
    if (!pl) return;
    exportCSV(`price-list-${pl.name.replace(/\s+/g, "-").toLowerCase()}`, exportRows(), exportCols);
    toast.success("CSV downloaded");
  }

  function downloadPDF() {
    if (!pl) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(`${pl.name} (${pl.currency.toUpperCase()}) — Product Snapshot`, 36, 34);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Generated ${new Date(pl.generated_at).toLocaleString()}`, 36, 50);
    doc.text(
      previous
        ? `Compared with ${previous.name} (${new Date(previous.generated_at).toLocaleDateString()})`
        : "First snapshot — no earlier price list available",
      36,
      64,
    );

    autoTable(doc, {
      startY: 76,
      margin: { left: 24, right: 24 },
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [20, 20, 20] },
      columns: exportCols.map((col) => ({ header: col.label, dataKey: col.key })),
      body: exportRows(),
      didParseCell: (data) => {
        const row = data.row.raw as { change?: DiffStatus } | undefined;
        if (data.section !== "body") return;
        if (row?.change === "added") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [255, 247, 224];
        }
        if (row?.change === "changed") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [180, 83, 9];
        }
        if (row?.change === "removed") {
          data.cell.styles.textColor = [120, 120, 120];
        }
      },
      didDrawCell: (data) => {
        const row = data.row.raw as { change?: DiffStatus } | undefined;
        if (data.section === "body" && row?.change === "removed") {
          const y = data.cell.y + data.cell.height / 2;
          doc.setDrawColor(120, 120, 120);
          doc.setLineWidth(0.75);
          doc.line(data.cell.x + 3, y, data.cell.x + data.cell.width - 3, y);
        }
      },
    });

    doc.save(`price-list-${pl.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast.success("PDF downloaded");
  }

  if (!pl) return <p className="text-muted-foreground">Loading…</p>;

  const activeCount = productRows.filter((row) => row.change === "active").length;
  const addedCount = productRows.filter((row) => row.change === "added").length;
  const changedCount = productRows.filter((row) => row.change === "changed").length;
  const removedCount = productRows.filter((row) => row.change === "removed").length;
  const rowClassName = (change: DiffStatus) =>
    change === "added"
      ? "font-bold bg-amber-500/10"
      : change === "changed"
        ? "font-semibold text-amber-600 dark:text-amber-400"
        : change === "removed"
          ? "text-muted-foreground line-through opacity-70"
          : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {pl.currency === "usd" ? (
          <Link to="/foodcost/us" className="text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-3 w-3" />Price Lists
          </Link>
        ) : (
          <Link to="/foodcost/in" className="text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 inline h-3 w-3" />Price Lists
          </Link>
        )}
        <h2 className="font-display text-lg font-semibold">{pl.name}</h2>
        <span className="text-xs uppercase text-muted-foreground">{pl.currency}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${TONE[pl.status]}`}>{pl.status}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={downloadCSV}>
            <FileDown className="mr-1 h-3 w-3" />CSV
          </Button>
          <Button size="sm" variant="outline" onClick={downloadPDF}>
            <FileDown className="mr-1 h-3 w-3" />PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
        <span>Generated {new Date(pl.generated_at).toLocaleString()}</span>
        <span>{previous ? `Compared with ${previous.name}` : "First snapshot"}</span>
        <span>Submitted {pl.submitted_at ? new Date(pl.submitted_at).toLocaleString() : "—"}</span>
        <span>Approved {pl.approved_at ? new Date(pl.approved_at).toLocaleString() : "—"}</span>
        <span>Active {activeCount}</span>
        <span>
          Added {addedCount} · Changed {changedCount} · Removed {removedCount}
        </span>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Products to Review ({productRows.length})</h3>
        <div className="rounded-2xl border border-border bg-surface-elevated">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-right">FC</th>
                <th className="px-4 py-2 text-left">PTR rule</th>
                <th className="px-4 py-2 text-right">PTR</th>
                <th className="px-4 py-2 text-right">Packing</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-left">Selling rule</th>
                <th className="px-4 py-2 text-right">Selling price</th>
              </tr>
            </thead>
            <tbody>
              {productRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                    No products in this snapshot.
                  </td>
                </tr>
              )}
              {productRows.map((row) => {
                const tone = rowClassName(row.change);
                return (
                  <tr key={row.id} className="border-b border-border/40 last:border-0">
                    <td className={`px-4 py-2 text-xs uppercase ${tone}`}>{row.changeLabel}</td>
                    <td className={`px-4 py-2 ${tone}`}>{row.name}</td>
                    <td className={`px-4 py-2 text-xs ${tone}`}>{row.category}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${tone}`}>{row.fc}</td>
                    <td className={`px-4 py-2 text-xs ${tone}`}>{row.ptrRule}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${tone}`}>{row.ptr}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${tone}`}>{row.packing}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${tone}`}>{row.total}</td>
                    <td className={`px-4 py-2 text-xs ${tone}`}>{row.mrpRule}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${tone}`}>{row.selling}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
