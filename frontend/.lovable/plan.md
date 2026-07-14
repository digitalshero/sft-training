## Problems

**1. Admin can't assign cuisine & products in Assign Visitor dialog**
The dialog currently only shows the cuisine/products read-only, pulled from `lp_product_assignments` (set by the partner). If the partner hasn't picked them, the visitor email goes out with "—" for cuisine and an empty product list.

**2. Visitor email never arrives**
Confirmed via `email_send_log`: every physical-visit email is being rejected by the email API with:
```
400 missing_unsubscribe — "Transactional emails must include an unsubscribe_token"
```
After 5 retries the message moves to DLQ. `src/lib/sft/physical-visit-email.server.ts` enqueues the payload without an `unsubscribe_token` (and without a `suppressed_emails` check), unlike `src/lib/partner/invite-email.server.ts` which does it correctly.

## Fix Plan

### A. Add Cuisine + Products assignment to the dialog
- `src/components/sft/AssignVisitorDialog.tsx`
  - Add a **Cuisine** dropdown (loaded via existing `listCuisines` server fn, scoped to the visit's `course_id`).
  - Add a **Products** multi-select (recipes filtered by the chosen cuisine, via existing `listRecipes`).
  - Pre-fill from `visit.cuisine_id` / `visit.assigned_products` when present.
  - Both fields required before submit.

- `src/lib/sft/physical-visit.functions.ts` → `assignVisitor`
  - Extend Zod schema with `cuisine_id: uuid` and `recipe_ids: uuid[]` (min 1).
  - Inside handler, **replace** the partner's `lp_product_assignments` for this `(user_id, course_id)`:
    - Delete existing rows for that user+course.
    - Insert one row per selected `recipe_id` with the chosen `cuisine_id`.
  - Store `cuisine_id` on `lp_physical_visits` (already supported) and set `recipe_id` to the first selected product so downstream code that reads `visit.recipe_id` still works.
  - Existing email dispatch automatically picks up the new assignments → cuisine + product list appear in the visitor email.

### B. Fix the visitor & partner emails actually sending
- `src/lib/sft/physical-visit-email.server.ts` — update the `enqueue()` helper to mirror `invite-email.server.ts`:
  1. Normalize recipient email, check `suppressed_emails` → skip if suppressed.
  2. Look up / mint a token in `email_unsubscribe_tokens` for that recipient.
  3. Add `unsubscribe_token: <token>` to the enqueued payload.
- No DB/schema changes needed (tables already exist).
- After the fix, re-trigger via the existing **"Resend"** action on the admin page for the failed visits so partner + visitor receive the mail.

## Out of scope
- No changes to the Visitor Portal, the email templates themselves, or the partner cook flow.
- DLQ entries from past failed sends are left as-is; admin can resend.