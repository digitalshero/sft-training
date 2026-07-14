-- DropTable
-- Reverts 20260711120000_add_sft_invites: the Partner Invite & Admin Flow
-- feature was removed. Kept as a forward migration (rather than editing or
-- deleting the original migration) so migration history stays consistent
-- for anyone who already applied it.
DROP TABLE IF EXISTS "sft_invites";
