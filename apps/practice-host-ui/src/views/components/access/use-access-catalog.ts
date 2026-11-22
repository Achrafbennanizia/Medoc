/** The access catalogue (areas, levels, roles, ceilings). Loaded once per session and shared. */
import { useEffect, useState } from "react";
import { getAccessCatalog, type AccessCatalog } from "@/systems/practice-host/controllers/access.controller";

let cached: Promise<AccessCatalog> | null = null;

export function loadAccessCatalog(): Promise<AccessCatalog> {
    cached ??= getAccessCatalog().catch((e: unknown) => {
        cached = null;
        throw e;
    });
    return cached;
}

export function useAccessCatalog(): { catalog: AccessCatalog | null; error: unknown } {
    const [catalog, setCatalog] = useState<AccessCatalog | null>(null);
    const [error, setError] = useState<unknown>(null);
    useEffect(() => {
        let live = true;
        loadAccessCatalog().then(
            (c) => live && setCatalog(c),
            (e: unknown) => live && setError(e),
        );
        return () => {
            live = false;
        };
    }, []);
    return { catalog, error };
}
