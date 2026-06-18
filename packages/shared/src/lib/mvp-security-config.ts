/**
 * MVP security feature flags and staff quota constants.
 * TODO(deferred-security): Re-enable — see `docs/coordination/todos-deferred-security-features.md`.
 */

/** Break-Glass (Notfallzugriff) — disabled for MVP. */
export const BREAK_GLASS_ENABLED = false;

/** TOTP two-factor authentication — disabled for MVP. */
export const TOTP_2FA_ENABLED = false;

/** Max ARZT accounts (admin slot). */
export const MAX_ARZT = 1;

/** Max REZEPTION accounts (user slots). */
export const MAX_REZEPTION = 4;

/** Max total staff accounts. Must match `mvp_security::MAX_TOTAL_PERSONAL` in Rust. */
export const MAX_TOTAL_PERSONAL = 5;
