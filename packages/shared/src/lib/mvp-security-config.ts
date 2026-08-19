/**
 * MVP security feature flags and staff quota constants.
 * TODO(deferred-security): Re-enable — see `docs/coordination/todos-deferred-security-features.md`.
 */

/** Break-Glass (Notfallzugriff) — disabled for MVP. */
export const BREAK_GLASS_ENABLED = false;

/** TOTP two-factor authentication — disabled and unwired for MVP. */
export const TOTP_2FA_ENABLED = false;

/** Max PHYSICIAN accounts (admin slot). */
export const MAX_PHYSICIAN = 1;

/** Max RECEPTION accounts (user slots). */
export const MAX_RECEPTION = 4;

/** Max total staff accounts. Must match `mvp_security::MAX_TOTAL_STAFF` in Rust. */
export const MAX_TOTAL_STAFF = 5;
