// ── Supabase client STUB ──────────────────────────────────────────────────────
// Supabase has been replaced by our custom Express backend.
// This file exists only so any residual imports don't crash during migration.
// Real calls go through src/lib/api/client.ts (Axios).
// ---------------------------------------------------------------------------
// DO NOT add new Supabase calls here. Use src/lib/api/client.ts instead.

export const supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: (_event: unknown, _cb: unknown) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: () => Promise.resolve({ error: null }),
    signInWithPassword: () => Promise.reject(new Error("Use /api/auth/signin")),
    signUp: () => Promise.reject(new Error("Use /api/auth/signup")),
    resetPasswordForEmail: () => Promise.reject(new Error("Use /api/auth/forgot-password")),
    updateUser: () => Promise.reject(new Error("Use /api/auth/update-password")),
    getClaims: () => Promise.reject(new Error("JWT handled server-side")),
  },
};
