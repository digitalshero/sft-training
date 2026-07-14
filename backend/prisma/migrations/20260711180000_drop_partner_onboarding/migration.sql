-- DropTable
-- Reverts 20260711160000_add_partner_onboarding: the Stripe/OTP partner
-- onboarding feature was removed. Kept as a forward migration (rather than
-- editing or deleting the original migration) so migration history stays
-- consistent for anyone who already applied it.
DROP TABLE IF EXISTS "partner_invites";
DROP TABLE IF EXISTS "partner_payments";
DROP TABLE IF EXISTS "partner_otp";
