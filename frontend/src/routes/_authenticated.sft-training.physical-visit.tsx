/* eslint-disable */
import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listPhysicalVisits,
  resendVisitEmails,
  type PhysicalVisitRow,
} from "@/lib/sft/physical-visit.functions";
import { formatDateTimeET } from "@/lib/datetime-et";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Search,
  MapPin,
  Loader2,
  History,
  Copy,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from "lucide-react";
import { DeletePartnerRecordButton } from "@/components/sft/DeletePartnerRecordButton";
import { exportXLSX, type ExportColumn } from "@/lib/export";

export const Route = createFileRoute(
  "/_authenticated/sft-training/physical-visit",
)({
  component: PhysicalVisitPage,
});

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "eligible", label: "Eligible for Assignment" },
  { value: "visitor_assigned", label: "Visitor Assigned" },
  { value: "visit_scheduled", label: "Visit Scheduled" },
  { value: "visit_completed", label: "Visit Completed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "waiting_admin_reschedule", label: "Waiting for Admin Reschedule" },
  { value: "certified", label: "Certified" },
];

const STATUS_LABEL: Record<string, string> = {
  eligible: "Eligible",
  visitor_assigned: "Visitor Assigned",
  visit_scheduled: "Visit Scheduled",
  visit_completed: "Visit Completed",
  approved: "Approved",
  rejected: "Rejected",
  rescheduled: "Rescheduled",
  waiting_admin_reschedule: "Waiting Admin",
  certified: "Certified",
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    eligible: "bg-amber-100 text-amber-800 border-amber-200",
    visitor_assigned: "bg-blue-100 text-blue-800 border-blue-200",
    visit_scheduled: "bg-sky-100 text-sky-800 border-sky-200",
    visit_completed: "bg-teal-100 text-teal-800 border-teal-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
    rescheduled: "bg-indigo-100 text-indigo-800 border-indigo-200",
    waiting_admin_reschedule: "bg-orange-100 text-orange-800 border-orange-200",
    certified: "bg-primary/15 text-primary border-primary/30",
  };
  return (
    <Badge
      variant="outline"
      className={map[status] ?? "bg-muted text-muted-foreground"}
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function PhysicalVisitPage() {
  // The "assign visitor" / "reschedule" flow is a nested child route
  // (/physical-visit/assign/$visitId) — without delegating to it here, the
  // URL changes on click but this list just keeps rendering itself. Computed
  // up front, but the early return happens after every hook below is called
  // (unconditionally), to avoid changing hook order between renders.
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const inAssignFlow = pathname.split("/").length > 3;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const qc = useQueryClient();
  const fnList = listPhysicalVisits;
  const q = useQuery({
    queryKey: ["physical-visits", search, status],
    queryFn: () => fnList({ status, search }),
  });

  const rows = useMemo(() => q.data ?? [], [q.data]);

  const exportCols: ExportColumn<PhysicalVisitRow>[] = [
    { key: "partner_name", label: "Partner Name" },
    { key: "partner_email", label: "Partner Email" },
    { key: "partner_phone", label: "Partner Phone" },
    { key: "partner_location", label: "Partner Location" },
    { key: "visitor_name", label: "Visitor Name" },
    { key: "visitor_email", label: "Visitor Email" },
    { key: "visitor_phone", label: "Visitor Phone" },
    { key: "visit_date", label: "Visit Date" },
    { key: "visit_time", label: "Visit Time" },
    { key: "assigned_products", label: "Assigned Products", get: (r) => r.assigned_products.join(", ") },
    { key: "accepted_products", label: "Accepted Products" },
    { key: "rejected_products", label: "Rejected Products" },
    { key: "inspection_percentage", label: "Approval Percentage", get: (r) => r.inspection_percentage ?? "" },
    { key: "status", label: "Final Visit Status" },
  ];
  const paged = useMemo(
    () => rows.slice(page * pageSize, (page + 1) * pageSize),
    [rows, page],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  const [photoVisit, setPhotoVisit] = useState<PhysicalVisitRow | null>(null);
  const [historyVisit, setHistoryVisit] = useState<PhysicalVisitRow | null>(
    null,
  );
  const [commentsVisit, setCommentsVisit] = useState<PhysicalVisitRow | null>(
    null,
  );

  const fnResend = resendVisitEmails;
  const resendMut = useMutation({
    mutationFn: (visitId: string) => fnResend({ id: visitId, target: "both" }),
    onSuccess: () => toast.success("Emails resent"),
    onError: (e: unknown) => {
      if (e instanceof Error) toast.error(e.message);
      else toast.error("Failed to resend");
    },
  });

  const copyPortal = (url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Portal link copied"));
  };

  if (inAssignFlow) return <Outlet />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Physical Visit Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Assign visitors, schedule kitchen inspections, and track
            verification results.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full flex-1 sm:min-w-60">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search partner, visitor, cuisine…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-8"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportXLSX("physical-visits", rows, exportCols)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Sheet
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Visit Date</TableHead>
                  <TableHead>Cuisine</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead>Photos</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-10 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!q.isLoading && paged.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No partners match this view.
                    </TableCell>
                  </TableRow>
                )}
                {paged.map((row) => {
                  type LocalVisit = PhysicalVisitRow & { portal_url?: string };
                  const r = row as LocalVisit;
                  const isEligible = r.status === "eligible";
                  const canReschedule =
                    r.status === "rejected" ||
                    r.status === "waiting_admin_reschedule";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">
                          {r.partner_name ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.partner_email ?? ""}
                        </div>
                        {r.partner_location && (
                          <div className="text-xs text-muted-foreground">
                            {r.partner_location}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.visitor_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.visitor_email ?? ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.visit_date ? <div>{r.visit_date}</div> : "—"}
                        {r.visit_time && (
                          <div className="text-muted-foreground">
                            {r.visit_time}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.cuisine_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.assigned_products.length ? (
                          <div className="flex max-w-45 flex-wrap gap-1">
                            {r.assigned_products.slice(0, 3).map((p) => (
                              <Badge
                                key={p}
                                variant="secondary"
                                className="font-normal"
                              >
                                {p}
                              </Badge>
                            ))}
                            {r.assigned_products.length > 3 && (
                              <Badge variant="outline" className="font-normal">
                                +{r.assigned_products.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs">#{r.attempt_no}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell>
                        {r.decision ? (
                          <Badge
                            variant="outline"
                            className={
                              r.decision === "approved"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                            }
                          >
                            {r.decision}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-50 truncate text-xs"
                        title={r.decision_comments ?? ""}
                      >
                        {r.decision_comments ? (
                          <button
                            className="text-primary underline-offset-2 hover:underline"
                            onClick={() => setCommentsVisit(r)}
                          >
                            View
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {r.photos.length > 0 ? (
                          <button
                            className="flex items-center gap-1"
                            onClick={() => setPhotoVisit(r)}
                            title={`${r.photos.length} photo(s)`}
                          >
                            <div className="flex -space-x-1">
                              {r.photos
                                .slice(0, 3)
                                .map((p) =>
                                  p.signed_url ? (
                                    <img
                                      key={p.id}
                                      src={p.signed_url}
                                      alt=""
                                      className="h-8 w-8 rounded border-2 border-background object-cover"
                                    />
                                  ) : null,
                                )}
                            </div>
                            {r.photos.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{r.photos.length - 3}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {isEligible ? (
                            <Button asChild size="sm">
                              <Link
                                to="/sft-training/physical-visit/assign/$visitId"
                                params={{ visitId: r.id }}
                              >
                                Assign Visitor
                              </Link>
                            </Button>
                          ) : canReschedule ? (
                            <Button asChild size="sm" variant="default">
                              <Link
                                to="/sft-training/physical-visit/assign/$visitId"
                                params={{ visitId: r.id }}
                              >
                                <RefreshCw className="h-3.5 w-3.5" /> Reschedule
                              </Link>
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {r.portal_url && (
                                  <DropdownMenuItem
                                    onClick={() => r.portal_url && copyPortal(r.portal_url)}
                                  >
                                    <Copy className="mr-2 h-3.5 w-3.5" /> Copy
                                    Portal Link
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => resendMut.mutate(r.id)}
                                >
                                  Resend Email
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setHistoryVisit(r)}
                                >
                                  <History className="mr-2 h-3.5 w-3.5" /> View
                                  History
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {r.invite_id && (
                            <DeletePartnerRecordButton
                              inviteId={r.invite_id}
                              partnerName={r.partner_name ?? "Partner"}
                              partnerEmail={r.partner_email ?? ""}
                              onDeleted={() =>
                                qc.invalidateQueries({ queryKey: ["physical-visits"] })
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {rows.length > pageSize && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {page + 1} of {pageCount} · {rows.length} total
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!photoVisit}
        onOpenChange={(v) => !v && setPhotoVisit(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Onsite Photos · {photoVisit?.partner_name}
            </DialogTitle>
            <DialogDescription>
              Attempt #{photoVisit?.attempt_no} · uploaded by{" "}
              {photoVisit?.visitor_name ?? "visitor"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {photoVisit && photoVisit.total_products ? (
              photoVisit.product_inspections.map((insp) => {
                const productPhotos = photoVisit.photos.filter(
                  (p) => p.product_id === insp.product_id,
                );
                return (
                  <div key={insp.product_id}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      {insp.status === "accepted" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : insp.status === "rejected" ? (
                        <XCircle className="h-4 w-4 text-rose-600" />
                      ) : null}
                      {insp.product_name}
                    </div>
                    {productPhotos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No photos uploaded</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                        {productPhotos.map((p) => (
                          <a key={p.id} href={p.signed_url ?? "#"} target="_blank" rel="noreferrer">
                            {p.signed_url && (
                              <img
                                src={p.signed_url}
                                alt={insp.product_name}
                                className="aspect-square w-full rounded border object-cover"
                              />
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {photoVisit?.photos.map((p) => (
                  <a
                    key={p.id}
                    href={p.signed_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    {p.signed_url && (
                      <img
                        src={p.signed_url}
                        alt={p.caption ?? ""}
                        className="aspect-square w-full rounded border object-cover"
                      />
                    )}
                    {p.caption && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.caption}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!commentsVisit}
        onOpenChange={(v) => !v && setCommentsVisit(null)}
      >
          <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {commentsVisit?.total_products ? "Inspection Report" : "Visitor Comments"}
            </DialogTitle>
            <DialogDescription>
              {commentsVisit?.partner_name} · Attempt #
              {commentsVisit?.attempt_no}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {commentsVisit?.total_products ? (
              <>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Inspection Score</div>
                    <div className="text-xs text-muted-foreground">
                      {commentsVisit.accepted_products}/{commentsVisit.total_products} products approved
                    </div>
                  </div>
                  <div className="text-2xl font-bold">
                    {commentsVisit.inspection_percentage ?? 0}%
                  </div>
                </div>
                <div className="space-y-1.5">
                  {commentsVisit.product_inspections.map((insp) => (
                    <div
                      key={insp.product_id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>{insp.product_name}</span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          insp.status === "accepted" ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {insp.status === "accepted" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {insp.status === "accepted" ? "Accepted" : "Rejected"}
                      </span>
                    </div>
                  ))}
                </div>
                {commentsVisit.decision && (
                  <Badge
                    variant="outline"
                    className={
                      commentsVisit.decision === "approved"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-rose-100 text-rose-800 border-rose-200"
                    }
                  >
                    Final Decision: {commentsVisit.decision}
                  </Badge>
                )}
              </>
            ) : null}
            <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
              {commentsVisit?.decision_comments ?? "—"}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!historyVisit}
        onOpenChange={(v) => !v && setHistoryVisit(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Visit History · {historyVisit?.partner_name}
            </DialogTitle>
            <DialogDescription>
              All past attempts for this partner
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {historyVisit?.history.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No prior attempts recorded yet.
              </p>
            )}
            {historyVisit?.history.map((h) => (
              <div key={h.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Attempt #{h.attempt_no}</div>
                  {h.decision && (
                    <Badge
                      variant="outline"
                      className={
                        h.decision === "approved"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : "bg-rose-100 text-rose-800 border-rose-200"
                      }
                    >
                      {h.decision}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {h.visitor_name ?? "—"} ·{" "}
                  {h.submitted_at
                    ? formatDateTimeET(h.submitted_at)
                    : "—"}
                </div>
                {!!h.total_products && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="font-medium">
                      Inspection Score: {h.inspection_percentage ?? 0}%
                    </span>
                    <span className="text-muted-foreground">
                      ({h.accepted_products}/{h.total_products} approved)
                    </span>
                  </div>
                )}
                {h.product_inspections?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {h.product_inspections.map((insp) => (
                      <span
                        key={insp.product_id}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          insp.status === "accepted"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {insp.status === "accepted" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {insp.product_name}
                      </span>
                    ))}
                  </div>
                )}
                {h.comments && (
                  <div className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 text-sm">
                    {h.comments}
                  </div>
                )}
                {h.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {h.photos.map(
                      (p) =>
                        p.signed_url && (
                          <a
                            key={p.id}
                            href={p.signed_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={p.signed_url}
                              alt=""
                              className="h-16 w-16 rounded border object-cover"
                            />
                          </a>
                        ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
