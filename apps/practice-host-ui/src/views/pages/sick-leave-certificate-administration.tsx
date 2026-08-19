import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/models/store/auth-store";
import { listStaff } from "@/systems/practice-host/controllers/staff.controller";
import {
    endSickLeaveCertificate,
    sickLeaveCertificateSave,
    listKrankenbescheinigungen,
    type SickLeaveCertificateRecord,
} from "@/systems/practice-host/controllers/sick-leave-certificate.controller";
import { saveSickLeaveCertificateAtomic } from "@/lib/sick-leave-certificate-orchestrator";
import type { Staff } from "@/models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { errorMessage } from "@/lib/utils";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";

async function fileToDocumentRef(file: File, fileReadError: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
            const data = typeof fr.result === "string" ? fr.result : "";
            resolve(`${file.name}|${data}`);
        };
        fr.onerror = () => reject(fr.error ?? new Error(fileReadError));
        fr.readAsDataURL(file);
    });
}

export function SickLeaveCertificateFormPage() {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const sessionUserId = useAuthStore((s) => s.session?.user_id ?? "");
    const toast = useToastStore((s) => s.add);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [records, setRecords] = useState<SickLeaveCertificateRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [staffId, setStaffId] = useState(sessionUserId);
    const [note, setNote] = useState("");
    const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
    const [dateTo, setDateTo] = useState("");
    const [file, setFile] = useState<File | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [staff, list] = await Promise.all([listStaff(), listKrankenbescheinigungen()]);
            setStaff(staff);
            setRecords(list);
            if (!staffId && staff[0]) setStaffId(staff[0].id);
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (sessionUserId) setStaffId(sessionUserId);
    }, [sessionUserId]);

    const selected = useMemo(
        () => records.find((r) => r.id === selectedId) ?? null,
        [records, selectedId],
    );

    const staffOptions = useMemo(
        () => staff.map((p) => ({ value: p.id, label: p.name })),
        [staff],
    );

    async function handleSave() {
        if (!file || !staffId) {
            toast(t("page.sick_leave_certificate.toast.required"), "error");
            return;
        }
        setBusy(true);
        try {
            const documentRef = await fileToDocumentRef(file, t("page.sick_leave_certificate.err.file_read"));
            const result = await saveSickLeaveCertificateAtomic(
                async (input) => {
                    const rec = await sickLeaveCertificateSave({
                        staffId: input.staffId,
                        note: input.note || null,
                        documentRef: input.documentRef,
                        dateFrom: input.dateFrom,
                        dateTo: input.dateTo ?? null,
                    });
                    return { id: rec.id };
                },
                {
                    staffId,
                    note: note.trim(),
                    documentRef,
                    dateFrom,
                    dateTo: dateTo || undefined,
                },
            );
            toast(tp("page.sick_leave_certificate.toast.saved", { count: result.cancelledBlockCount }), "success");
            setNote("");
            setFile(null);
            await load();
        } catch (e) {
            toast(tp("page.sick_leave_certificate.toast.save_failed", { error: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    }

    async function handleEnd(id: string) {
        setBusy(true);
        try {
            await endSickLeaveCertificate(id);
            toast(t("page.sick_leave_certificate.toast.ended"), "success");
            setSelectedId(null);
            await load();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    }

    if (loading && records.length === 0) return <PageLoading />;
    if (loadError && records.length === 0) return <PageLoadError message={loadError} onRetry={() => void load()} />;

    return (
        <div className="practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                title={t("page.sick_leave_certificate.title")}
                subtitle={t("page.sick_leave_certificate.subtitle")}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: "start" }}>
                <Card>
                    <CardHeader title={t("page.sick_leave_certificate.form.new")} />
                    <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <Select
                            id="kb-staff"
                            label={t("page.sick_leave_certificate.label.staff")}
                            value={staffId}
                            onChange={(e) => setStaffId(e.target.value)}
                            options={staffOptions}
                        />
                        <Input id="kb-from" type="date" label={t("page.sick_leave_certificate.label.from")} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        <Input id="kb-to" type="date" label={t("page.sick_leave_certificate.label.to_optional")} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        <Textarea id="kb-note" label={t("page.sick_leave_certificate.label.note")} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                        <label style={{ fontSize: 13 }}>
                            {t("page.sick_leave_certificate.label.document")}
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                style={{ display: "block", marginTop: 4 }}
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            />
                            {file ? <span style={{ color: "var(--fg-3)" }}>{file.name}</span> : null}
                        </label>
                        <Button type="button" disabled={!file || !staffId || busy} loading={busy} onClick={() => void handleSave()}>
                            {t("page.sick_leave_certificate.save")}
                        </Button>
                    </div>
                </Card>

                <Card>
                    <CardHeader title={t("page.sick_leave_certificate.entries")} />
                    <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflow: "auto" }}>
                        {records.length === 0 ? (
                            <p style={{ margin: 0, color: "var(--fg-3)" }}>{t("page.sick_leave_certificate.empty")}</p>
                        ) : (
                            records.map((r) => (
                                <button
                                    key={r.id}
                                    type="button"
                                    className={selectedId === r.id ? "btn btn-accent" : "btn btn-ghost"}
                                    style={{ textAlign: "left", justifyContent: "flex-start" }}
                                    onClick={() => setSelectedId(r.id)}
                                >
                                    <div>
                                        <strong>{staff.find((p) => p.id === r.staffId)?.name ?? r.staffId}</strong>
                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                                            {r.dateFrom}
                                            {r.dateTo ? ` – ${r.dateTo}` : ""} · {r.status}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {selected ? (
                <div style={{ marginTop: 16 }}>
                <Card>
                    <CardHeader title={t("page.sick_leave_certificate.detail")} />
                    <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <p style={{ margin: 0 }}>
                            <strong>{t("page.sick_leave_certificate.period")}</strong> {selected.dateFrom}
                            {selected.dateTo ? ` – ${selected.dateTo}` : ""}
                        </p>
                        {selected.note ? <p style={{ margin: 0 }}>{selected.note}</p> : null}
                        <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>
                            {tp("page.sick_leave_certificate.created", {
                                datetime: format(parseISO(selected.createdAt), "dd.MM.yyyy HH:mm", { locale: dateFnsLocale }),
                            })}
                        </p>
                        {selected.status === "ACTIVE" ? (
                            <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleEnd(selected.id)}>
                                {t("page.sick_leave_certificate.end")}
                            </Button>
                        ) : null}
                    </div>
                </Card>
                </div>
            ) : null}
        </div>
    );
}
