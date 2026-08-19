/**
 * TODO(deferred-roles): Re-enable TAX_ADVISOR + PHARMA_CONSULTANT — see
 * `docs/coordination/planned.md` and `todos-deferred-roles.md`.
 *
 * Login roles disabled for MVP; DB enum values remain for migrations/legacy rows.
 */

/** Set `true` when re-enabling advisor roles (see deferred-roles checklist). */
export const DEFERRED_ROLES_ENABLED = false;

/** Wire strings for disabled login personae. */
export const DEFERRED_ROLE_WIRES = ["TAX_ADVISOR", "PHARMA_CONSULTANT"] as const;

export type DeferredRoleWire = (typeof DEFERRED_ROLE_WIRES)[number];

/** Active MVP login roles (sidebar, team create, parseRole). */
export const ACTIVE_ROLE_WIRES = ["PHYSICIAN", "RECEPTION"] as const;

export type ActiveRoleWire = (typeof ACTIVE_ROLE_WIRES)[number];

export function isDeferredRoleWire(role: string | undefined | null): boolean {
    if (DEFERRED_ROLES_ENABLED || role == null) return false;
    return (DEFERRED_ROLE_WIRES as readonly string[]).includes(role);
}

export function isActiveRoleWire(role: string | undefined | null): role is ActiveRoleWire {
    return role != null && (ACTIVE_ROLE_WIRES as readonly string[]).includes(role);
}
