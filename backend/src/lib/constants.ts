// The one account that must always retain super_admin access, regardless of
// who else is managing users in the Admin UI.
export const PERMANENT_SUPER_ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@shero.in').toLowerCase();