import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { PatientComboField } from "../components/patient-combo-field";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { listPatienten } from "../../controllers/patient.controller";
import {
    dsgvoExportPatient,
    dsgvoErasePatient,
    type ErasureReport,
} from "../../controllers/ops.controller";
import type { Patient } from "../../models/types";
import { clearPatientScopedBrowserStorage } from "../../lib/patient-browser-storage";
import { errorMessage, formatTpl } from "../../lib/utils";
import { openExportPreview } from "../../models/store/export-preview-store";
import { useT } from "../../lib/i18n";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

/**
 * Datenschutz-Seite — DSGVO Art. 15 (Auskunft), 17 (Löschung), 20 (Übertragbarkeit).
 * Bündelt Patientenexport (JSON) und Löschanfrage (Pseudonymisierung mit Aufbewahrung
 * klinischer Daten bis Ablauf §630f BGB / 30 Jahre).
 */
const PAGE_SIZE = 50;

export function DatenschutzPage() {
    const t = useT();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [filter, setFilter] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [confirmErase, setConfirmErase] = useState<Patient | null>(null);
    const [eraseReport, setEraseReport] = useState<ErasureReport | null>(null);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [patientsError, setPatientsError] = useState<string | null>(null);
    const [tablePage, setTablePage] = useState(0);
    const [patientPickId, setPatientPickId] = useState("");
    const toast = useToastStore((s) => s.add);

    const loadPatients = useCallback(async () => {
        setPatientsLoading(true);
        setPatientsError(null);
        try {
            setPatients(await listPatienten());
        } catch (e) {
            setPatientsError(errorMessage(e));
            setPatients([]);
        } finally {
            setPatientsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPatients();
    }, [loadPatients]);

    const filtered = patients.filter((p) =>
        p.name.toLowerCase().includes(filter.toLowerCase()),
    );

    useEffect(() => {
        setTablePage(0);
    }, [filter, patients.length]);

    const totalFiltered = filtered.length;
    const pageCount = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    const safePage = Math.min(tablePage, pageCount - 1);
    const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    async function handleExport(p: Patient) {
        setBusyId(p.id);
        try {
            const data = await dsgvoExportPatient(p.id);
            const json = JSON.stringify(data, null, 2);
            openExportPreview({
                format: "json",
                title: t("page.datenschutz.dialog_preview_title"),
                hint: `DSGVO-Datenpaket für ${p.name} · JSON strukturiert drucken oder speichern.`,
                suggestedFilename: `dsgvo-export-${p.id}.json`,
                textBody: json,
            });
        } catch (e) {
            toast(`${t("page.datenschutz.toast_error_prefix")} ${errorMessage(e)}`);
        } finally {
            setBusyId(null);
        }
    }

    async function handleErase() {
        if (!confirmErase) return;
        setBusyId(confirmErase.id);
        try {
            const report = await dsgvoErasePatient(confirmErase.id);
            clearPatientScopedBrowserStorage(confirmErase.id);
            setEraseReport(report);
            toast(t("page.datenschutz.toast_erase_done"));
            setConfirmErase(null);
            await loadPatients();
        } catch (e) {
            toast(`${t("page.datenschutz.toast_error_prefix")} ${errorMessage(e)}`);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <h2 className="page-title">{t("page.datenschutz.title")}</h2>
            <p style={{ color: "var(--fg-3)", fontSize: 14 }}>
                {t("page.datenschutz.intro_prefix")}
                <em>{t("page.datenschutz.intro_em")}</em>
                {t("page.datenschutz.intro_suffix")}
            </p>

            <Card className="card-pad">
                <CardHeader title={t("page.datenschutz.card_search")} />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">{t("page.datenschutz.loading")}</p>
                ) : patientsError ? null : (
                    <PatientComboField
                        id="dsgvo-patient-filter"
                        label={t("page.datenschutz.filter_label")}
                        patienten={patients}
                        patientId={patientPickId}
                        onPatientIdChange={setPatientPickId}
                        onQueryChange={setFilter}
                        placeholder={t("page.datenschutz.filter_ph")}
                    />
                )}
            </Card>

            {patientsLoading ? (
                <PageLoading label={t("page.datenschutz.loading")} />
            ) : patientsError ? (
                <PageLoadError message={patientsError} onRetry={() => void loadPatients()} />
            ) : filtered.length === 0 ? (
                <EmptyState icon="👥" title={t("page.datenschutz.empty_title")} description={t("page.datenschutz.empty_desc")} />
            ) : (
                <div className="card">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>{t("page.datenschutz.col.name")}</th>
                                <th>{t("page.datenschutz.col.status")}</th>
                                <th>{t("page.datenschutz.col.actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map((p) => (
                                <tr key={p.id}>
                                    <td>{p.name}</td>
                                    <td>{p.status}</td>
                                    <td className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                        <Button size="sm" onClick={() => handleExport(p)} disabled={busyId === p.id}>
                                            {t("page.datenschutz.export_json")}
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => setConfirmErase(p)} disabled={busyId === p.id}>
                                            {t("page.datenschutz.erase_request")}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {totalFiltered > 0 ? (
                        <div className="card-pad" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                <span style={{ color: "var(--fg-3)", fontSize: 13 }}>
                                    {totalFiltered <= PAGE_SIZE
                                        ? formatTpl(t("page.datenschutz.page_all"), { count: totalFiltered })
                                        : formatTpl(t("page.datenschutz.page_range"), {
                                            from: safePage * PAGE_SIZE + 1,
                                            to: Math.min((safePage + 1) * PAGE_SIZE, totalFiltered),
                                            total: totalFiltered,
                                        })}
                                </span>
                                {totalFiltered > PAGE_SIZE ? (
                                    <div className="row" style={{ gap: 8 }}>
                                        <Button size="sm" variant="ghost" disabled={safePage <= 0} onClick={() => setTablePage((p) => {
                                            const cur = Math.min(p, pageCount - 1);
                                            return Math.max(0, cur - 1);
                                        })}>
                                            {t("page.datenschutz.nav_back")}
                                        </Button>
                                        <Button size="sm" variant="ghost" disabled={safePage >= pageCount - 1} onClick={() => setTablePage((p) => {
                                            const cur = Math.min(p, pageCount - 1);
                                            return Math.min(pageCount - 1, cur + 1);
                                        })}>
                                            {t("page.datenschutz.nav_next")}
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}

            <ConfirmDialog
                open={!!confirmErase}
                onClose={() => setConfirmErase(null)}
                onConfirm={handleErase}
                title={t("page.datenschutz.erase_title")}
                message={confirmErase ? formatTpl(t("page.datenschutz.erase_confirm"), { name: confirmErase.name }) : ""}
                confirmLabel={t("page.datenschutz.erase_confirm_btn")}
                danger
                loading={busyId === confirmErase?.id}
            />

            {eraseReport && (
                <Card className="card-pad">
                    <CardHeader title={t("page.datenschutz.report_title")} />
                    <ul className="text-body" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                        <li>{t("page.datenschutz.report_patient_id")} <span style={{ fontFamily: "ui-monospace, monospace" }}>{eraseReport.patient_id}</span></li>
                        <li>{t("page.datenschutz.report_anonymised")} {eraseReport.anonymised_at}</li>
                        <li>{t("page.datenschutz.report_records")} {eraseReport.deleted_records}</li>
                    </ul>
                </Card>
            )}
        </div>
    );
}
