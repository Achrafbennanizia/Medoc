import { Rolle } from "@/generated/prisma";

type Resource =
    | "termine"
    | "patienten"
    | "patientenakte"
    | "behandlung"
    | "zahnschema"
    | "anamnesebogen"
    | "zahlungen"
    | "finanzen"
    | "leistungen"
    | "produkte"
    | "personal"
    | "statistiken"
    | "einstellungen"
    | "audit";

type Action = "read" | "create" | "update" | "delete";

const permissions: Record<Rolle, Partial<Record<Resource, Action[]>>> = {
    ARZT: {
        termine: ["read", "create", "update", "delete"],
        patienten: ["read", "create", "update", "delete"],
        patientenakte: ["read", "create", "update"],
        behandlung: ["read", "create", "update", "delete"],
        zahnschema: ["read", "create", "update"],
        anamnesebogen: ["read"],
        zahlungen: ["read"],
        finanzen: ["read"],
        leistungen: ["read", "create", "update", "delete"],
        produkte: ["read", "create", "update", "delete"],
        personal: ["read", "create", "update", "delete"],
        statistiken: ["read"],
        einstellungen: ["read", "update"],
        audit: ["read"],
    },
    REZEPTION: {
        termine: ["read", "create", "update"],
        patienten: ["read", "create", "update"],
        patientenakte: ["read", "create"],
        behandlung: ["read"],
        zahnschema: ["read"],
        anamnesebogen: ["read"],
        zahlungen: ["read", "create", "update"],
        finanzen: ["read"],
        leistungen: ["read"],
        produkte: ["read"],
        personal: ["read"],
        statistiken: ["read"],
    },
    STEUERBERATER: {
        zahlungen: ["read"],
        finanzen: ["read"],
        statistiken: ["read"],
    },
    PHARMABERATER: {
        produkte: ["read"],
    },
};

export function canAccess(
    rolle: Rolle,
    resource: Resource,
    action: Action
): boolean {
    const allowed = permissions[rolle]?.[resource];
    if (!allowed) return false;
    return allowed.includes(action);
}

export function requireAccess(
    rolle: Rolle,
    resource: Resource,
    action: Action
): void {
    if (!canAccess(rolle, resource, action)) {
        throw new Error(
            `Zugriff verweigert: Rolle '${rolle}' darf '${action}' auf '${resource}' nicht ausführen.`
        );
    }
}

export type { Resource, Action };
