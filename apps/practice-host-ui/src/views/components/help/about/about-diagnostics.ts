/**
 * Plain-text diagnostics for support. Identifiers and states only — never names, notes or messages.
 * Pure: everything it reads is passed in, so it is unit-tested (about-diagnostics.test.ts).
 */
import { formatOffset } from "./about-format";
import { latestBackup, shortId, type AboutStatus } from "./about-status";

export type DiagnosticsInput = {
    readonly status: AboutStatus;
    readonly version: string;
    readonly devBuild: boolean;
    readonly platform: string;
    readonly screen: { readonly width: number; readonly height: number };
    readonly locale: string;
    readonly textSize: string;
    readonly zoomPct: number;
    readonly now: Date;
    readonly timeZone: string;
    /** Clock offset to the practice host in ms, or null when this device uses its own clock. */
    readonly clockOffsetMs: number | null;
    readonly errors: ReadonlyArray<{ readonly code: string; readonly route: string; readonly at: number }>;
};

export function buildDiagnostics(d: DiagnosticsInput): string {
    const { status } = d;
    const lines = [
        `MeDoc ${d.version} (${d.devBuild ? "development" : "release"})`,
        `Platform: ${d.platform} · screen ${d.screen.width}×${d.screen.height}`,
        `Language: ${d.locale} · text ${d.textSize} · zoom ${d.zoomPct}%`,
        `Time: ${d.now.toISOString()} · ${d.timeZone} · ${d.clockOffsetMs == null ? "local clock" : `synced ${formatOffset(d.clockOffsetMs)}`}`,
    ];
    if (status.license.state === "ok") {
        const l = status.license.value;
        const edition = l.licenseV2?.edition ?? l.license?.edition ?? "?";
        lines.push(`Licence: ${l.valid ? "valid" : `invalid (${l.reason ?? "?"})`} · ${edition} · expires in ${l.daysUntilExpiry ?? "∞"} d`);
    }
    if (status.sync.state === "ok") {
        const s = status.sync.value;
        lines.push(`Device: ${s.deployment.role} ${shortId(s.localDeviceId)} · peers ${s.peers.length} · pending ${s.pendingOutbox}`);
    }
    if (status.health.state === "ok") {
        const h = status.health.value;
        const audit = h.audit_chain_ok ? "ok" : `broken at ${h.audit_broken_at}`;
        lines.push(`Health: db ${h.db_ok ? "ok" : "FAIL"} ${h.db_latency_ms} ms · audit ${audit} · logs ${h.log_dir_writable ? "writable" : "NOT writable"}`);
    }
    if (status.backups.state === "ok") {
        const last = latestBackup(status.backups.value);
        lines.push(`Backups: ${status.backups.value.length} · latest ${last ? new Date(last.at).toISOString() : "none"}`);
    }
    if (d.errors.length) {
        lines.push("Recent errors (code · page · time):");
        for (const e of d.errors.slice(0, 8)) lines.push(`  ${e.code} · ${e.route} · ${new Date(e.at).toISOString()}`);
    }
    return lines.join("\n");
}
