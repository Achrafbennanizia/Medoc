/**
 * Compliance page body: live data-protection status, the practice checklist for its jurisdiction
 * (Morocco law 09-08 when it bills in MAD, GDPR otherwise) and the registers to generate.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage, formatDate, formatDateTime } from "@/lib/utils";
import { loadClientSettings } from "@/lib/client-settings";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import {
    COMPLIANCE_ITEMS,
    checklistProgress,
    complianceJurisdiction,
    parseComplianceChecklist,
    toggleChecklistItem,
    EMPTY_CHECKLIST,
    type ComplianceChecklistState,
    type ComplianceJurisdiction,
} from "@/lib/compliance-checklist";
import { systemHealthCheck, type HealthCheck } from "@/systems/practice-host/controllers/system.controller";
import { listBackups, type BackupInfo } from "@/systems/practice-host/controllers/ops.controller";
import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import { useAuthStore } from "@/models/store/auth-store";
import { latestBackup, type Tone } from "@/views/components/help/about/about-status";
import { StatusCard } from "@/views/components/help/about/about-primitives";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";

export type ComplianceReportKind = "vvt" | "dpia" | "retention";

const WEEK_MS = 7 * 86_400_000;

type Loaded<T> = { state: "loading" } | { state: "ok"; value: T } | { state: "error" };

function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
    const [v, setV] = useState<Loaded<T>>({ state: "loading" });
    useEffect(() => {
        let alive = true;
        load().then(
            (value) => alive && setV({ state: "ok", value }),
            () => alive && setV({ state: "error" }),
        );
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per mount
    }, []);
    return v;
}

export function ComplianceOverview({ onRunReport, busy }: { onRunReport: (kind: ComplianceReportKind) => void; busy: boolean }) {
    const practice = getInvoicePracticeFromStorage();
    const jurisdiction = complianceJurisdiction(practice.currency);
    return (
        <div className="compliance-overview">
            <ComplianceStatus jurisdiction={jurisdiction} ice={practice.ma_ice} ifNumber={practice.ma_if} />
            <ComplianceChecklist jurisdiction={jurisdiction} />
            <ComplianceReports jurisdiction={jurisdiction} onRun={onRunReport} busy={busy} />
        </div>
    );
}

/* ───────────────────────── live status ───────────────────────── */

function ComplianceStatus({ jurisdiction, ice, ifNumber }: { jurisdiction: ComplianceJurisdiction; ice?: string; ifNumber?: string }) {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const health = useLoaded<HealthCheck>(systemHealthCheck);
    // Metadata only: the signature check belongs to the Ops page and must not slow this one down.
    const backups = useLoaded<BackupInfo[]>(() => listBackups({ verifySignatures: false }));
    const idleMinutes = loadClientSettings().security?.idleLogoutMinutes ?? 0;
    const k = (s: string) => `page.compliance.status.${s}`;
    const go = (path: string, label: string) => (
        <Button type="button" size="sm" variant="secondary" onClick={() => navigate(path)}>
            {label}
        </Button>
    );

    let dataTone: Tone = "unknown";
    let dataText = t("help.about.loading");
    if (health.state === "ok") {
        const h = health.value;
        dataTone = h.db_ok && h.audit_chain_ok ? "ok" : "problem";
        dataText = !h.db_ok ? t(k("data.problem_db")) : !h.audit_chain_ok ? t(k("data.problem_audit")) : t(k("data.ok"));
    } else if (health.state === "error") {
        dataText = t("help.about.unavailable");
    }

    let backupTone: Tone = "unknown";
    let backupText = t("help.about.loading");
    if (backups.state === "ok") {
        const last = latestBackup(backups.value);
        if (!last) {
            backupTone = "warn";
            backupText = t(k("backup.none"));
        } else {
            const old = Date.now() - last.at > WEEK_MS;
            backupTone = old ? "warn" : "ok";
            backupText = tp(k(old ? "backup.old" : "backup.last"), { date: formatDateTime(new Date(last.at).toISOString()) });
        }
    } else if (backups.state === "error") {
        backupText = t("help.about.unavailable");
    }

    const invoiceOk = Boolean(ice?.trim() && ifNumber?.trim());

    return (
        <section className="compliance-section" aria-labelledby="compliance-status-title">
            <header className="compliance-section__head">
                <h2 id="compliance-status-title">{t(k("title"))}</h2>
                <p>{t(k("intro"))}</p>
            </header>
            <div className="about-status-grid">
                <StatusCard title={t(k("data.title"))} tone={dataTone} summary={dataText} action={go("/audit", t(k("data.action")))} />
                <StatusCard title={t(k("backup.title"))} tone={backupTone} summary={backupText} action={go("/ops", t(k("backup.action")))} />
                <StatusCard
                    title={t(k("lock.title"))}
                    tone={idleMinutes > 0 ? "ok" : "warn"}
                    summary={idleMinutes > 0 ? tp(k("lock.on"), { min: idleMinutes }) : t(k("lock.off"))}
                    action={go("/settings", t(k("lock.action")))}
                />
                <StatusCard title={t(k("rights.title"))} tone="ok" summary={t(k("rights.ok"))} action={go("/privacy", t(k("rights.action")))} />
                {jurisdiction === "ma" ? (
                    <StatusCard
                        title={t(k("invoice.title"))}
                        tone={invoiceOk ? "ok" : "problem"}
                        summary={t(k(invoiceOk ? "invoice.ok" : "invoice.missing"))}
                        action={go("/settings", t(k("invoice.action")))}
                    />
                ) : null}
                <StatusCard title={t(k("twofa.title"))} tone="warn" summary={t(k("twofa.text"))} />
            </div>
        </section>
    );
}

/* ───────────────────────── checklist ───────────────────────── */

function ComplianceChecklist({ jurisdiction }: { jurisdiction: ComplianceJurisdiction }) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const user = useAuthStore((s) => s.session?.name ?? "");
    const [state, setState] = useState<ComplianceChecklistState>(EMPTY_CHECKLIST);
    const [loaded, setLoaded] = useState(false);
    const [cndp, setCndp] = useState({ ref: "", date: "" });

    useEffect(() => {
        void getAppKv("compliance.checklist.v1")
            .then((raw) => {
                const s = parseComplianceChecklist(raw);
                setState(s);
                setCndp({ ref: s.cndpRef, date: s.cndpDate });
            })
            .catch(() => undefined)
            .finally(() => setLoaded(true));
    }, []);

    const save = useCallback(
        async (next: ComplianceChecklistState) => {
            const prev = state;
            setState(next);
            try {
                await setAppKv("compliance.checklist.v1", JSON.stringify(next));
            } catch (e) {
                setState(prev);
                toast(tp("page.compliance.checklist.save_failed", { message: errorMessage(e) }), "error");
            }
        },
        [state, toast, tp],
    );

    const ids = COMPLIANCE_ITEMS[jurisdiction];
    const progress = checklistProgress(state, jurisdiction);
    const base = `page.compliance.checklist.${jurisdiction}`;

    return (
        <section className="compliance-section" aria-labelledby="compliance-checklist-title">
            <header className="compliance-section__head compliance-section__head--row">
                <div>
                    <h2 id="compliance-checklist-title">{t(`page.compliance.checklist.title_${jurisdiction}`)}</h2>
                    <p>{t("page.compliance.checklist.intro")}</p>
                </div>
                <span className={`pill ${progress.done === progress.total ? "green" : "grey"}`}>
                    {tp("page.compliance.checklist.progress", { done: progress.done, total: progress.total })}
                </span>
            </header>
            <ul className="compliance-checklist">
                {ids.map((id) => {
                    const mark = state.items[id];
                    const inputId = `compliance-item-${id}`;
                    return (
                        <li key={id} className={mark?.done ? "is-done" : undefined}>
                            <input
                                id={inputId}
                                type="checkbox"
                                checked={Boolean(mark?.done)}
                                disabled={!loaded}
                                onChange={() => void save(toggleChecklistItem(state, id, user))}
                            />
                            <label htmlFor={inputId}>
                                <span className="compliance-checklist__title">{t(`${base}.${id}.title`)}</span>
                                <span className="compliance-checklist__detail">{t(`${base}.${id}.detail`)}</span>
                                {mark?.done && mark.at ? (
                                    <span className="compliance-checklist__meta">
                                        {tp("page.compliance.checklist.ticked", { by: mark.by || "—", date: formatDateTime(mark.at) })}
                                    </span>
                                ) : null}
                            </label>
                        </li>
                    );
                })}
            </ul>
            {jurisdiction === "ma" ? (
                <form
                    className="compliance-cndp"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void save({ ...state, cndpRef: cndp.ref.trim(), cndpDate: cndp.date }).then(() =>
                            toast(t("page.compliance.checklist.saved"), "success"),
                        );
                    }}
                >
                    <Input id="compliance-cndp-ref" label={t("page.compliance.checklist.cndp_ref")} value={cndp.ref} onChange={(e) => setCndp((c) => ({ ...c, ref: e.target.value }))} />
                    <Input id="compliance-cndp-date" type="date" label={t("page.compliance.checklist.cndp_date")} value={cndp.date} onChange={(e) => setCndp((c) => ({ ...c, date: e.target.value }))} />
                    <Button type="submit" variant="secondary" disabled={!loaded}>
                        {t("common.save")}
                    </Button>
                    {state.cndpRef ? (
                        <p className="compliance-cndp__current">
                            {tp("page.compliance.checklist.cndp_current", { ref: state.cndpRef, date: state.cndpDate ? formatDate(state.cndpDate) : "—" })}
                        </p>
                    ) : null}
                </form>
            ) : null}
        </section>
    );
}

/* ───────────────────────── registers ───────────────────────── */

function ComplianceReports({ jurisdiction, onRun, busy }: { jurisdiction: ComplianceJurisdiction; onRun: (k: ComplianceReportKind) => void; busy: boolean }) {
    const t = useT();
    const reports: { kind: ComplianceReportKind; button: string }[] = [
        { kind: "vvt", button: "page.compliance.btn.vvt" },
        { kind: "dpia", button: "page.compliance.btn.dpia" },
        { kind: "retention", button: "page.compliance.btn.retention" },
    ];
    return (
        <section className="compliance-section" aria-labelledby="compliance-reports-title">
            <header className="compliance-section__head">
                <h2 id="compliance-reports-title">{t("page.compliance.reports.title")}</h2>
                <p>{t(`page.compliance.reports.intro_${jurisdiction}`)}</p>
            </header>
            <div className="compliance-reports">
                {reports.map((r) => (
                    <article key={r.kind} className="compliance-report-card">
                        <h3>{t(r.button)}</h3>
                        <p>{t(`page.compliance.reports.${r.kind}_desc`)}</p>
                        <Button type="button" size="sm" variant={r.kind === "retention" ? "secondary" : "primary"} disabled={busy} onClick={() => onRun(r.kind)}>
                            {t(r.button)}
                        </Button>
                    </article>
                ))}
            </div>
        </section>
    );
}
