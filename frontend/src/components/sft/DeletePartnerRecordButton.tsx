import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteSftInvite } from "@/lib/learning/learning.functions";
import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";

// Shared "delete this partner's SFT record" action for admin pages that list
// partner invites (Invite & Certify, SFT Review, Physical Visit, Partner
// Journey). Always deletes one invite + that partner's data for that one
// course only — never the login account, never other courses.
export function DeletePartnerRecordButton({
  inviteId,
  partnerName,
  partnerEmail,
  onDeleted,
  size = "sm",
  variant = "ghost",
}: {
  inviteId: string;
  partnerName: string;
  partnerEmail: string;
  onDeleted: () => void;
  size?: "sm" | "default";
  variant?: "ghost" | "outline";
}) {
  const del = useMutation({
    mutationFn: () => deleteSftInvite({ id: inviteId }),
    onSuccess: () => {
      toast.success("Partner record deleted");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size={size}
          variant={variant}
          className="text-destructive"
          disabled={del.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this partner&apos;s record?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes <strong>{partnerName}</strong>&apos;s (
            {partnerEmail}) invite, enrolment, uploads, submissions, physical
            visit, and certificate for this course. It does not affect their
            access to any other course, and does not touch shared cuisine,
            recipe, or quiz content. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={del.isPending}
            onClick={() => del.mutate()}
          >
            Confirm Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
