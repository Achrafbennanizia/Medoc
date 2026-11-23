/**
 * About & support — live application status (data layer).
 *
 * One hook loads every source in parallel and shows each result as it arrives: a slow, denied or failing
 * source never blocks the others. Pure helpers below turn the raw data into a tone (ok / warn / problem /
 * unknown) and are unit-tested (about-status.test.ts).
 */
import { useCallback, useEffect, useState } from "react";
import { currentAppVersion, currentLicenseStatus, systemHealthCheck, type HealthCheck, type LicenseStatus } from "@/systems/practice-host/controllers/system.controller";
import { listBackups, type BackupInfo } from "@/systems/practice-host/controllers/ops.controller";
import { clusterGetStatus } from "@/systems/practice-host/controllers/cluster.controller";
import { syncGetStatus, type SyncStatusSnapshot } from "@/systems/practice-host/controllers/sync.controller";
import { getLogDir } from "@/systems/practice-host/controllers/logging.controller";
import type { ClusterStatusSnapshot } from "@/models/store/cluster-store";

export type Loaded<T> =
    | { readonly state: "loading" }
    | { readonly state: "ok"; readonly value: T }
    | { readonly state: "denied" }
    | { readonly state: "error"; readonly message: string };

export type Tone = "ok" | "warn" | "problem" | "unknown";

export type AboutStatus = {
    readonly version: Loaded<string>;
    readonly license: Loaded<LicenseStatus>;
    readonly cluster: Loaded<ClusterStatusSnapshot>;
    readonly sync: Loaded<SyncStatusSnapshot>;
    readonly health: Loaded<HealthCheck>;
    readonly backups: Loaded<BackupInfo[]>;
    readonly logDir: Loaded<string>;
    readonly loadedAt: number | null;
};

const LOADING = { state: "loading" } as const;

/** Permission / sign-in failures are "denied", not errors: the page says so instead of showing a red error. */
export function settle<T>(r: PromiseSettledResult<T>): Loaded<T> {
    if (r.status === "fulfilled") return { state: "ok", value: r.value };
    const msg = r.reason instanceof Error ? r.reason.message : String(r.reason ?? "");
    if (/forbidden|unauthori[sz]ed|permission|not_authenticated|session/i.test(msg)) return { state: "denied" };
    return { state: "error", message: msg };
}

export function useAboutStatus(): { status: AboutStatus; refresh: () => void; loading: boolean } {
    const [status, setStatus] = useState<AboutStatus>({
        version: LOADING,
        license: LOADING,
        cluster: LOADING,
        sync: LOADING,
        health: LOADING,
        backups: LOADING,
        logDir: LOADING,
        loadedAt: null,
    });
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(() => {
        let cancelled = false;
        setLoading(true);
        // Each source lands on its own: fast ones (version, licence, network) show at once while
        // health (full audit chain) and backups are still running. About only needs backup
        // metadata, so it skips the per-file signature check the Ops page does.
        const sources: { [K in Exclude<keyof AboutStatus, "loadedAt">]: () => Promise<unknown> } = {
            version: currentAppVersion,
            license: currentLicenseStatus,
            cluster: clusterGetStatus,
            sync: syncGetStatus,
            health: systemHealthCheck,
            backups: () => listBackups({ verifySignatures: false }),
            logDir: getLogDir,
        };
        const keys = Object.keys(sources) as (keyof typeof sources)[];
        let open = keys.length;
        setStatus((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, LOADING])) }));
        for (const key of keys) {
            void Promise.allSettled([sources[key]()]).then(([result]) => {
                if (cancelled) return;
                setStatus((prev) => ({ ...prev, [key]: settle(result), loadedAt: Date.now() }));
                open -= 1;
                if (open === 0) setLoading(false);
            });
        }
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => refresh(), [refresh]);
    return { status, refresh, loading };
}

/* ───────────────────────── pure helpers (tested) ───────────────────────── */

/** Backup file `medoc-20261121T130359Z.db` (optionally `-2`) → its UTC timestamp. */
export function backupTakenAt(path: string): number | null {
    const m = /medoc-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z(?:-\d+)?\.db$/.exec(path);
    if (!m) return null;
    const [, y, mo, d, h, mi, s] = m;
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

export function latestBackup(backups: readonly BackupInfo[]): { info: BackupInfo; at: number } | null {
    let best: { info: BackupInfo; at: number } | null = null;
    for (const b of backups) {
        const at = backupTakenAt(b.path);
        if (at != null && (!best || at > best.at)) best = { info: b, at };
    }
    return best;
}

const DAY_MS = 86_400_000;

export function licenseTone(l: LicenseStatus): Tone {
    if (!l.valid) return "problem";
    if (l.daysUntilExpiry != null && l.daysUntilExpiry <= 30) return "warn";
    return "ok";
}

export function dataTone(health: HealthCheck | null, backups: readonly BackupInfo[] | null, now: number): Tone {
    if (health && (!health.db_ok || !health.audit_chain_ok || !health.log_dir_writable)) return "problem";
    if (backups) {
        const last = latestBackup(backups);
        if (!last || now - last.at > 7 * DAY_MS) return "warn";
        if (last.info.signature_ok === false) return "problem";
    }
    if (!health && !backups) return "unknown";
    return "ok";
}

/** Peers not seen for an hour, or a large unsent queue, mean sync needs attention. */
export function networkTone(sync: SyncStatusSnapshot, now: number): Tone {
    if (sync.pendingOutbox > 500) return "problem";
    const stale = sync.peers.some((p) => !p.lastSeenAt || now - Date.parse(p.lastSeenAt) > 3_600_000);
    if (stale || sync.pendingOutbox > 100) return "warn";
    return "ok";
}

export function shortId(id: string | null | undefined): string {
    if (!id) return "—";
    return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
