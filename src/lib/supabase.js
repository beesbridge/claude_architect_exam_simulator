// Kept for backwards compatibility — the real backend abstraction lives in
// ./store.js (which supports both Supabase and the local SQLite API).
export { MODE, configured as isConfigured, ALLOWED_DOMAIN, emailAllowed } from './store'
