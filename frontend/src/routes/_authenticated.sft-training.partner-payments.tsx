import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listPartnerPayments,
  createPartnerPayment,
  deletePartnerPayment,
  type PartnerPaymentRow,
} from "@/lib/partner-payments/partner-payments.functions";
import { EmailDeliveryLogPanel } from "@/components/sft/EmailDeliveryLogPanel";
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Loader2, Copy, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sft-training/partner-payments")({
  component: PartnerPaymentsPage,
});

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "red" | "yellow";
}) {
  const toneClass = {
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-rose-100 text-rose-700",
    yellow: "bg-amber-100 text-amber-700",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${toneClass}`}
    >
      {label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: PartnerPaymentRow["payment_status"] }) {
  return status === "paid" ? (
    <StatusBadge label="Paid" tone="green" />
  ) : (
    <StatusBadge label="Unpaid" tone="red" />
  );
}

function ApprovalStatusBadge({ status }: { status: PartnerPaymentRow["approval_status"] }) {
  if (status === "accepted") return <StatusBadge label="Accepted" tone="green" />;
  if (status === "rejected") return <StatusBadge label="Rejected" tone="red" />;
  return <StatusBadge label="Pending" tone="yellow" />;
}

function InviteStatusBadge({ status }: { status: PartnerPaymentRow["invite_status"] }) {
  return status === "sent" ? (
    <StatusBadge label="Sent" tone="green" />
  ) : (
    <StatusBadge label="Pending" tone="yellow" />
  );
}

function formatUsd(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function PartnerPaymentsPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const paymentsQ = useQuery({
    queryKey: ["partner-payments"],
    queryFn: listPartnerPayments,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["partner-payments"] });

  const createMut = useMutation({
    mutationFn: createPartnerPayment,
    onSuccess: (row) => {
      toast.success(
        row.payment_status === "paid"
          ? "Test payment created — invite email sent automatically"
          : "Test payment created",
      );
      invalidate();
      setAddOpen(false);
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error ?? "Failed to create payment"),
  });

  const deleteMut = useMutation({
    mutationFn: deletePartnerPayment,
    onSuccess: () => {
      toast.success("Payment record deleted");
      invalidate();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error ?? "Failed to delete payment"),
  });

  const payments = paymentsQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Partner Payments
          </h2>
          <p className="text-sm text-muted-foreground">
            Payment records arrive automatically from the payment webhook. A
            paid partner is accepted, synced into Invite &amp; Certify, and
            emailed their sign-in link with no manual steps.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add test payment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All payments</CardTitle>
          <CardDescription>
            A <span className="font-medium">Paid</span> record is accepted
            and invited automatically — Approval and Invite status update on
            their own.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsQ.isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No payment records yet. They'll appear here as soon as one
              becomes available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner ID</TableHead>
                    <TableHead>Partner Name</TableHead>
                    <TableHead>Partner Email</TableHead>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Approval Status</TableHead>
                    <TableHead>Invite Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.id}</TableCell>
                      <TableCell className="font-medium">{p.partner_name}</TableCell>
                      <TableCell>{p.partner_email}</TableCell>
                      <TableCell className="font-mono text-xs">{p.payment_id}</TableCell>
                      <TableCell>{formatUsd(p.amount)}</TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={p.payment_status} />
                      </TableCell>
                      <TableCell>
                        <ApprovalStatusBadge status={p.approval_status} />
                      </TableCell>
                      <TableCell>
                        <InviteStatusBadge status={p.invite_status} />
                      </TableCell>
                      <TableCell>
                        <PaymentActions
                          payment={p}
                          isPending={deleteMut.isPending}
                          onDelete={() => deleteMut.mutate({ id: p.id })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EmailDeliveryLogPanel />

      <AddTestPaymentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(data) => createMut.mutate(data)}
        isPending={createMut.isPending}
      />
    </div>
  );
}

function AddTestPaymentDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    partner_name: string;
    partner_email: string;
    payment_id: string;
    amount: number;
    payment_status: "paid" | "unpaid";
  }) => void;
  isPending: boolean;
}) {
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [paymentId, setPaymentId] = useState(`TEST-${Date.now().toString(36).toUpperCase()}`);
  const [amount, setAmount] = useState("999");
  const [paid, setPaid] = useState(true);

  function reset() {
    setPartnerName("");
    setPartnerEmail("");
    setPaymentId(`TEST-${Date.now().toString(36).toUpperCase()}`);
    setAmount("999");
    setPaid(true);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add test payment</DialogTitle>
          <DialogDescription>
            Simulates a webhook delivery — a Paid record automatically
            triggers the same accept + invite-email pipeline a real payment
            would, so you can verify the whole flow end to end.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Partner name</Label>
            <Input
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="Priya Ramesh"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Partner email</Label>
            <Input
              type="email"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              placeholder="partner@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payment ID</Label>
            <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Amount (USD)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label className="text-sm">Paid</Label>
            <Switch checked={paid} onCheckedChange={setPaid} />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full"
            disabled={!partnerName.trim() || !partnerEmail.trim() || !paymentId.trim() || isPending}
            onClick={() =>
              onSubmit({
                partner_name: partnerName.trim(),
                partner_email: partnerEmail.trim(),
                payment_id: paymentId.trim(),
                amount: Number(amount) || 0,
                payment_status: paid ? "paid" : "unpaid",
              })
            }
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePaymentButton({
  payment,
  isPending,
  onDelete,
}: {
  payment: PartnerPaymentRow;
  isPending: boolean;
  onDelete: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive" disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this payment record?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes {payment.partner_name}'s payment record
            ({payment.payment_id}) and its invite link. It does not affect
            anything already synced into Invite &amp; Certify if this partner
            was accepted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onDelete}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PaymentActions({
  payment,
  isPending,
  onDelete,
}: {
  payment: PartnerPaymentRow;
  isPending: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {payment.invite_link && (
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-accent hover:underline"
          onClick={() => {
            void navigator.clipboard.writeText(payment.invite_link!);
            toast.success("Invite link copied");
          }}
        >
          <Copy className="h-3 w-3" /> Copy link
        </button>
      )}
      <DeletePaymentButton payment={payment} isPending={isPending} onDelete={onDelete} />
    </div>
  );
}
