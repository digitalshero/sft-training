# Supabase → Custom Backend Migration

## What changed

| File | Change |
|---|---|
| `src/integrations/supabase/client.ts` | Replaced with stub — all real calls use Axios |
| `src/lib/api/client.ts` | **NEW** — Axios instance with JWT auto-refresh |
| `src/lib/auth.tsx` | Rewritten — JWT + /api/auth/me |
| `src/lib/use-roles.ts` | Reads roles from JWT user object |
| `src/hooks/use-permissions.tsx` | Reads permissions from JWT user object |
| `src/lib/admin/admin.functions.ts` | REST calls to /api/admin/* |
| `src/lib/learning/learning.functions.ts` | REST calls to /api/sft/* + /api/learning/* |
| `src/lib/learning/cuisines.functions.ts` | REST calls to /api/learning/* + /api/partner/* |
| `src/lib/learning/recipes.functions.ts` | REST calls to /api/learning/* |
| `src/lib/sft-training/deck.functions.ts` | REST calls to /api/sft/decks/* |
| `src/lib/partner/partner.functions.ts` | REST calls to /api/partner/* + /api/sft/* |
| `src/lib/sft/physical-visit.functions.ts` | REST calls to /api/sft/physical-visits/* |
| `src/routes/login.tsx` | Calls /api/auth/signin, /api/auth/signup, magic-link support |
| `src/routes/forgot-password.tsx` | Calls /api/auth/forgot-password |
| `src/routes/reset-password.tsx` | Calls /api/auth/reset-password |
| `src/routes/unsubscribe.tsx` | Calls /api/email/unsubscribe |
| `src/routes/visitor.physical-visit.tsx` | Calls /api/public/physical-visit/* |
| `src/start.ts` | Removed Supabase auth attacher middleware |
| `vite.config.ts` | Removed Lovable vite config, added dev proxy to :4000 |
| Deleted | `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, all `routes/api/*`, all `routes/lovable/*`, `invite-email.server.ts`, `physical-visit-email.server.ts` |

## Local dev setup

```bash
# 1. Start backend first
cd ../shero-backend
npm run dev   # runs on :4000

# 2. Start frontend
cd ../shero-frontend
npm install
cp .env.example .env.local
npm run dev   # runs on :5173, proxies /api → :4000
```

## Token handling

- Access token: stored in `localStorage` as `shero_access_token`
- Refresh token: stored as `shero_refresh_token`
- Auto-refreshed on 401 by Axios interceptor in `src/lib/api/client.ts`
- Magic link from partner invite emails: `?token=JWT` → stored + user fetched on login page
