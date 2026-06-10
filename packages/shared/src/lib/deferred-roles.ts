/**
 * TODO(deferred-roles): Re-enable STEUERBERATER + PHARMABERATER — see
 * `docs/coordination/geplant.md` and `todos-deferred-roles.md`.
 *
 * Login roles disabled for MVP; DB enum values remain for migrations/legacy rows.
 */

/** Set `true` when re-enabling advisor roles (see deferred-roles checklist). */
export const DEFERRED_ROLES_ENABLED = false;

/** Wire strings for disabled login personae. */
export const DEFERRED_ROLE_WIRES = ["STEUERBERATER", "PHARMABERATER"] as const;

export type DeferredRoleWire = (typeof DEFERRED_ROLE_WIRES)[number];

/** Active MVP login roles (sidebar, team create, parseRole). */
export const ACTIVE_ROLE_WIRES = ["ARZT", "REZEPTION"] as const;

export type ActiveRoleWire = (typeof ACTIVE_ROLE_WIRES)[number];

export function isDeferredRoleWire(rolle: string | undefined | null): boolean {
    if (DEFERRED_ROLES_ENABLED || rolle == null) return false;
    return (DEFERRED_ROLE_WIRES as readonly string[]).includes(rolle);
}

export function isActiveRoleWire(rolle: string | undefined | null): rolle is ActiveRoleWire {
    return rolle != null && (ACTIVE_ROLE_WIRES as readonly string[]).includes(rolle);
}
