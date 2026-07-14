// Admin — Email Delivery Log: shows every email sendEmail() has dispatched
// (invites, OTPs, certificates, etc.), with counts, filters, and a manual
// resend for anything that failed or was suppressed.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listEmailLog,
  resendEmailLog,
  type EmailLogWindow,
  type EmailLogRow,
} from "@/lib/email-log/email-log.functions";
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
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Loader2, Mail, RefreshCw, Send } from "lucide-react";
import { formatDateET } from "@/lib/datetime-et";

const WINDOWS: { value: EmailLogWindow; label: string }[] = [
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
  { value: "30d", label: "Last 30d" },
];

function StatusBadge({ status }: { status: EmailLogRow["status"] }) {
  const toneClass = {
    sent: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
    suppressed: "bg-amber-100 text-amber-700",
    pending: "bg-slate-100 text-slate-700",
  }[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${toneClass}`}>
      {status}
    </span>
  );
}

export function EmailDeliveryLogPanel() {
  const qc = useQueryClient();
  const [window, setWindow] = useState<EmailLogWindow>("7d");
  const [template, setTemplate] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const logQ = useQuery({
    queryKey: ["email-log", window, template, status, search],
    queryFn: () =>
      listEmailLog({
        window,
        template: template === "all" ? undefined : template,
        status: status === "all" ? undefined : status,
        search: search || undefined,
      }),
  });

  const resendMut = useMutation({
    mutationFn: resendEmailLog,
    onSuccess: () => {
      toast.success("Email resent");
      qc.invalidateQueries({ queryKey: ["email-log"] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error ?? "Failed to resend email"),
  });

  const counts = logQ.data?.counts ?? { total: 0, sent: 0, failed: 0, suppressed: 0, pending: 0 };
  const templates = logQ.data?.templates ?? [];
  const rows = logQ.data?.rows ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Email Delivery Log
          </CardTitle>
          <CardDescription>
            Every auth and app email dispatched — deduplicated by message.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ["email-log"] })}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Window:</span>
          {WINDOWS.map((w) => (
            <Button
              key={w.value}
              size="sm"
              variant={window === w.value ? "default" : "outline"}
              onClick={() => setWindow(w.value)}
            >
              {w.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="All templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All templates</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="suppressed">Suppressed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              placeholder="Search recipient email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
            />
            <Button size="sm" variant="outline" onClick={() => setSearch(searchInput.trim())}>
              Search
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["Total", counts.total, "text-foreground"],
              ["Sent", counts.sent, "text-emerald-600"],
              ["Failed", counts.failed, "text-rose-600"],
              ["Suppressed", counts.suppressed, "text-amber-600"],
              ["Pending", counts.pending, "text-blue-600"],
            ] as const
          ).map(([label, value, cls]) => (
            <div key={label} className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
            </div>
          ))}
        </div>

        {logQ.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No emails in this window.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateET(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {r.template_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.recipient_email}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={r.error_message ?? ""}>
                      {r.error_message ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resendMut.isPending}
                        onClick={() => resendMut.mutate({ id: r.id })}
                      >
                        {resendMut.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        Resend
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
