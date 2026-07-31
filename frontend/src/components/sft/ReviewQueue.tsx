import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listReviewPartners,
  type ReviewPartnerRow,
} from "@/lib/learning/learning.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Search, Eye, CheckCircle2, Award, FileSpreadsheet, CalendarClock } from "lucide-react";
import { PartnerTimelineDialog, StatusBadge, fmt } from "./PartnerTimelineDialog";
import { DeletePartnerRecordButton } from "./DeletePartnerRecordButton";
import { AssignVisitorForm } from "./AssignVisitorForm";
import { type PhysicalVisitRow } from "@/lib/sft/physical-visit.functions";
import { exportXLSX, type ExportColumn } from "@/lib/export";

type ReviewRow = ReviewPartnerRow & { visit_status?: string | null };

// A manual "push to Physical Visit" for a partner the automatic eligibility
// scan hasn't (yet) picked up — reuses the exact same "eligible-<userId>"
// convention the Physical Visit page's own auto-detected rows already use,
// so this creates the visit record through the identical, already-working
// path. This is a manual escape hatch alongside the automatic flow, not a
// replacement for it.
function manualEligibleVisitRow(r: ReviewRow): PhysicalVisitRow {
  return {
    id: `eligible-${r.user_id}`,
    user_id: r.user_id!,
    course_id: r.course_id,
    recipe_id: null,
    submission_id: null,
    attempt_no: 1,
    partner_name: r.recipient_name,
    partner_email: r.recipient_email,
    partner_location: null,
    partner_state: null,
    partner_country: null,
    partner_phone: null,
    partner_address: null,
    recipe_name: null,
    cuisine_id: null,
    cuisine_name: null,
    assigned_products: [],
    visitor_name: null,
    visitor_email: null,
    visitor_phone: null,
    visit_date: null,
    visit_time: null,
    remarks: null,
    status: "eligible",
    email_status: "pending",
    visitor_email_sent_at: null,
    partner_email_sent_at: null,
    submitted_at: null,
    decision: null,
    decision_comments: null,
    total_products: null,
    accepted_products: null,
    rejected_products: null,
    inspection_percentage: null,
    product_inspections: [],
    visitor_location: null,
    form_status: "not_sent",
    history: [],
    photos: [],
    invite_id: r.invite_id ?? null,
  };
}

export function ReviewQueue({ courseId }: { courseId?: string }) {
  const qc = useQueryClient();
  const fnList = listReviewPartners;
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openInvite, setOpenInvite] = useState<string | null>(null);
  const [manualVisitPartner, setManualVisitPartner] = useState<ReviewRow | null>(null);

  const query = useQuery({
    queryKey: ["lp-review-partners", courseId ?? "all"],
    queryFn: () => fnList({ courseId }),
  });

  const rows = useMemo(() => {
    const all = (query.data ?? []) as ReviewRow[];
    return all.filter((r) => {
      if (statusFilter !== "all") {
        if (statusFilter === "yet_to_start" && !r.yet_to_start) return false;
        if (
          statusFilter === "needs_review" &&
          r.submission_status !== "pending"
        )
          return false;
        if (statusFilter === "approved" && r.submission_status !== "approved")
          return false;
        if (statusFilter === "certified" && !r.certificate_code) return false;
        if (
          statusFilter === "in_progress" &&
          (r.modules_done === 0 || r.modules_done >= r.modules_total)
        )
          return false;
      }
      if (!q) return true;
      const needle = q.toLowerCase();
      return (
        r.recipient_name.toLowerCase().includes(needle) ||
        r.recipient_email.toLowerCase().includes(needle) ||
        r.course_title.toLowerCase().includes(needle)
      );
    });
  }, [query.data, q, statusFilter]);

  const exportCols: ExportColumn<ReviewRow>[] = [
    { key: "recipient_name", label: "Partner Name" },
    { key: "recipient_email", label: "Email" },
    { key: "course_title", label: "Course" },
    { key: "modules", label: "Module Progress", get: (r) => `${r.modules_done}/${r.modules_total}` },
    { key: "products_submitted", label: "Products Submitted" },
    { key: "products_approved", label: "Products Approved" },
    { key: "products_redo", label: "Products Requiring Redo" },
    { key: "products_pending", label: "Pending Products" },
    { key: "visit_status", label: "Physical Visit Status", get: (r) => r.visit_status ?? "Not Visited" },
    { key: "certificate_code", label: "Certificate Status", get: (r) => r.certificate_code ?? "Not Certified" },
    { key: "sent_at", label: "Invited Date", get: (r) => fmt(r.sent_at) },
    {
      key: "overall_status",
      label: "Current Overall Status",
      get: (r) =>
        r.certificate_code
          ? "Certified"
          : r.yet_to_start
            ? "Yet to Start"
            : (r.submission_status ?? (r.modules_done > 0 ? "In progress" : "Not started")),
    },
  ];

  const counts = useMemo(() => {
    const all = (query.data ?? []) as ReviewRow[];
    return {
      total: all.length,
      pending: all.filter((r) => r.submission_status === "pending").length,
      certified: all.filter((r) => r.certificate_code).length,
    };
  }, [query.data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Partner Review Queue</CardTitle>
            <CardDescription>
              {counts.total} partner{counts.total === 1 ? "" : "s"} ·{" "}
              {counts.pending} awaiting product review · {counts.certified}{" "}
              certified
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search partner or course"
                className="h-9 w-full pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All partners</SelectItem>
                <SelectItem value="yet_to_start">Yet to Start</SelectItem>
                <SelectItem value="needs_review">
                  Needs product review
                </SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="approved">Product approved</SelectItem>
                <SelectItem value="certified">Certified</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                qc.invalidateQueries({ queryKey: ["lp-review-partners"] })
              }
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportXLSX("sft-review", rows, exportCols)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Sheet
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading partners…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No partners match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  {!courseId && <TableHead>Course</TableHead>}
                  <TableHead>Modules</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Physical Visit</TableHead>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Invited</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.invite_id ?? `${r.user_id}-${r.course_id}`}>
                    <TableCell>
                      <div className="font-medium">{r.recipient_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.recipient_email}
                      </div>
                    </TableCell>
                    {!courseId && (
                      <TableCell className="text-sm">
                        {r.course_title}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="text-sm tabular-nums">
                        {r.modules_done}/{r.modules_total}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={r.submission_status} />
                    </TableCell>
                    <TableCell>
                      {r.visit_status === "approved" ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Visited & Approved
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Not Visited
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.certificate_code ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        >
                          <Award className="mr-1 h-3 w-3" />
                          {r.certificate_code}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmt(r.sent_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.invite_id && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOpenInvite(r.invite_id)}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" /> Open
                          </Button>
                          {r.user_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setManualVisitPartner(r)}
                            >
                              <CalendarClock className="mr-1 h-3.5 w-3.5" /> Physical Visit
                            </Button>
                          )}
                          <DeletePartnerRecordButton
                            inviteId={r.invite_id}
                            partnerName={r.recipient_name}
                            partnerEmail={r.recipient_email}
                            onDeleted={() =>
                              qc.invalidateQueries({ queryKey: ["lp-review-partners"] })
                            }
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {openInvite && (
        <PartnerTimelineDialog
          inviteId={openInvite}
          onOpenChange={(open) => !open && setOpenInvite(null)}
        />
      )}

      <Dialog
        open={!!manualVisitPartner}
        onOpenChange={(open) => !open && setManualVisitPartner(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
          {manualVisitPartner && (
            <AssignVisitorForm
              visit={manualEligibleVisitRow(manualVisitPartner)}
              onCancel={() => setManualVisitPartner(null)}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["physical-visits"] });
                qc.invalidateQueries({ queryKey: ["physical-visits-all"] });
                setManualVisitPartner(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
