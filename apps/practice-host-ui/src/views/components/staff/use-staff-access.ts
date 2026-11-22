/**
 * Editing one person's role and privileges: loads their access and the device placement, keeps a
 * draft (role, per-area levels, own-record scopes) and saves it where it belongs (main device).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    getDeviceInfo,
    getStaffAccess,
    ownScopes,
    placementOf,
    resetStaffAccess,
    setStaffAccess,
    setStaffScopes,
    type AccessAreaId,
    type AccessCatalog,
    type AccessLevel,
    type DeviceInfo,
    type StaffAccess,
} from "@/systems/practice-host/controllers/access.controller";

export type AccessDraft = { role: string; levels: Partial<Record<AccessAreaId, AccessLevel>>; own: AccessAreaId[] };

function draftFrom(access: StaffAccess, catalog: AccessCatalog): AccessDraft {
    return {
        role: access.template ?? catalog.defaultRoles[access.role] ?? "",
        levels: Object.fromEntries(access.areas.map((a) => [a.area, a.level])),
        own: ownScopes(access),
    };
}

/** Areas whose level differs from the chosen role: stored as per-person changes. */
export function grantsFor(draft: AccessDraft, catalog: AccessCatalog): Partial<Record<AccessAreaId, AccessLevel>> {
    const role = catalog.roles.find((r) => r.id === draft.role);
    if (!role) return draft.levels;
    return Object.fromEntries(Object.entries(draft.levels).filter(([a, l]) => role.levels[a as AccessAreaId] !== l));
}

export function useStaffAccess(staffId: string, catalog: AccessCatalog | null) {
    const [access, setAccess] = useState<StaffAccess | null>(null);
    const [device, setDevice] = useState<DeviceInfo | null>(null);
    const [draft, setDraft] = useState<AccessDraft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);

    useEffect(() => {
        let live = true;
        setAccess(null);
        void Promise.all([getStaffAccess(staffId), getDeviceInfo()]).then(
            ([a, d]) => live && (setAccess(a), setDevice(d)),
            (e: unknown) => live && setError(e),
        );
        return () => {
            live = false;
        };
    }, [staffId]);

    useEffect(() => {
        if (access && catalog) setDraft(draftFrom(access, catalog));
    }, [access, catalog]);

    /** Picking a role replaces every area level with that role's levels. */
    const pickRole = useCallback(
        (roleId: string) => {
            const role = catalog?.roles.find((r) => r.id === roleId);
            if (role) setDraft((d) => d && { ...d, role: roleId, levels: { ...role.levels } });
        },
        [catalog],
    );
    const setLevel = useCallback((area: AccessAreaId, level: AccessLevel) => setDraft((d) => d && { ...d, levels: { ...d.levels, [area]: level } }), []);
    const setOwn = useCallback(
        (area: AccessAreaId, own: boolean) => setDraft((d) => d && { ...d, own: own ? [...new Set([...d.own, area])] : d.own.filter((a) => a !== area) }),
        [],
    );

    const dirty = useMemo(() => {
        if (!access || !catalog || !draft) return false;
        return JSON.stringify(draft) !== JSON.stringify(draftFrom(access, catalog));
    }, [access, catalog, draft]);

    const run = async (op: () => Promise<StaffAccess>) => {
        setBusy(true);
        setError(null);
        try {
            setAccess(await op());
        } catch (e) {
            setError(e);
        } finally {
            setBusy(false);
        }
    };

    const save = () =>
        run(async () => {
            if (!draft || !catalog || !access) throw new Error("not loaded");
            const saved = await setStaffAccess(staffId, draft.role, grantsFor(draft, catalog));
            const scopesChanged = JSON.stringify([...draft.own].sort()) !== JSON.stringify(ownScopes(saved).sort());
            return scopesChanged ? setStaffScopes(staffId, draft.own) : saved;
        });
    const reset = () => run(() => resetStaffAccess(staffId));

    return { access, device, draft, busy, error, dirty, pickRole, setLevel, setOwn, save, reset, placement: placementOf(device, "manage_access") };
}
