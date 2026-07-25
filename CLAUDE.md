# shero-SFT — Project Guardrails

This is the SHE-RO partner training/certification platform (SFT = "Skill/Food
Training" program). Stack: Express + Prisma (Postgres) in `backend/`, React +
TanStack Router/Query in `frontend/`.

## Scope rule for SFT Prepare & Cook / SFT Review work

When asked to fix issues in the SFT "Prepare & Cook" upload flow or "SFT
Review" admin flow (duplicate products, wrong product names, stale/old
images reappearing, mobile-vs-laptop upload inconsistencies, slow review
page load), **only touch**:

- Partner → Prepare & Cook upload handling
  (`backend/src/routes/partner/index.ts`,
  `frontend/src/routes/_authenticated.partner.cook.tsx` and its upload
  components)
- Admin → SFT Review product display
  (`backend/src/routes/sft/index.ts` review/timeline endpoints,
  `frontend/src/components/sft/ReviewQueue.tsx`,
  `frontend/src/components/sft/PartnerTimelineDialog.tsx`)
- Related SFT submission API/query logic (`LpProductSubmission`,
  `LpProductAssignment`, `LpProductUploadDraft` models and their queries)
- Cleanup of existing incorrect **pending** partner submission data only

**Do not touch, refactor, or change behavior of**, unless the task is
explicitly about one of these:

- Partner login/authentication, OTP/email verification
- Payment verification flow
- Partner invitation flow (Invite & Certify's own invite/revoke/restore logic)
- Course Builder
- Training modules / quiz flow
- Certification flow (certificate issue/revoke)
- Physical Visit eligibility + physical assessment workflow
- Admin approval workflow in general, beyond SFT Review's *display* logic
- Email notification sending
- Any database table/model unrelated to SFT product submissions
- Any existing UI/component outside the SFT product-submission pages

**Never modify or hide data for already-Approved partners.** Cleanup and
dedup logic must only apply to partners whose submissions are still
Pending / Need Review / Redo / Waiting Approval. Approved partner records
and certificate history are read-only for this class of fix — keep history
in the database, only change what the UI surfaces as the *current* state.

## Data model notes relevant to this scope

- Product master = `LpRecipe` (`foodName`), scoped to `LpCuisine`.
- A partner's picked products = `LpProductAssignment` (`userId, courseId,
  cuisineId, recipeId`).
- A submission "round" = `LpProductSubmission` — **one row holds a JSON
  array of files for potentially many products**, not one row per product.
  Each file should carry a stable `assignment_id` tying it back to
  `LpProductAssignment`; legacy files may lack it and only have a `label`
  string, which must never be trusted as the display name (always resolve
  product/cuisine name live from `LpRecipe`/`LpCuisine` by id).
- At most one `LpProductSubmission` row per partner+course has
  `reviewedAt IS NULL` at a time (the active/in-flight round); everything
  else is reviewed history. "Latest submission per product" must be
  resolved by walking rounds newest-first and taking the first match per
  `assignment_id` (fallback: per resolved label) — do not show every round
  as if it were current.
- Uploads must always be product-scoped (`selectedImages[product_id]`
  style state), never a single shared "current image" variable — this
  matters especially for mobile/tablet upload UI, where race conditions
  between camera/gallery pickers and card re-renders are the most common
  cause of an image landing on the wrong product.
