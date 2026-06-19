import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/models/store/auth-store";
import { listPersonal } from "@/systems/practice-host/controllers/personal.controller";
import {
    endKrankenbescheinigung,
    krankenbescheinigungSave,
    listKrankenbescheinigungen,
    type KrankenbescheinigungRecord,
} from "@/systems/practice-host/controllers/krankenbescheinigung.controller";
import { saveKrankenbescheinigungAtomic } from "@/lib/krankenbescheinigung-orchestrator";
import type { Personal } from "@/models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
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

export function KrankenbescheinigungFormPage() {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const sessionUserId = useAuthStore((s) => s.session?.user_id ?? "");
    const toast = useToastStore((s) => s.add);
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [records, setRecords] = useState<KrankenbescheinigungRecord[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [personalId, setPersonalId] = useState(sessionUserId);
    const [note, setNote] = useState("");
    const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
    const [dateTo, setDateTo] = useState("");
    const [file, setFile] = useState<File | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [staff, list] = await Promise.all([listPersonal(), listKrankenbescheinigungen()]);
            setPersonal(staff);
            setRecords(list);
            if (!personalId && staff[0]) setPersonalId(staff[0].id);
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
        if (sessionUserId) setPersonalId(sessionUserId);
    }, [sessionUserId]);

    const selected = useMemo(
        () => records.find((r) => r.id === selectedId) ?? null,
        [records, selectedId],
    );

    const staffOptions = useMemo(
        () => personal.map((p) => ({ value: p.id, label: p.name })),
        [personal],
    );

    async function handleSave() {
        if (!file || !personalId) {
            toast(t("page.krankenbescheinigung.toast.required"), "error");
            return;
        }
        setBusy(true);
        try {
            const documentRef = await fileToDocumentRef(file, t("page.krankenbescheinigung.err.file_read"));
            const result = await saveKrankenbescheinigungAtomic(
                async (input) => {
                    const rec = await krankenbescheinigungSave({
                        personalId: input.personalId,
                        note: input.note || null,
                        documentRef: input.documentRef,
                        dateFrom: input.dateFrom,
                        dateTo: input.dateTo ?? null,
                    });
                    return { id: rec.id };
                },
                {
                    personalId,
                    note: note.trim(),
                    documentRef,
                    dateFrom,
                    dateTo: dateTo || undefined,
                },
            );
            toast(tp("page.krankenbescheinigung.toast.saved", { count: result.cancelledBlockCount }), "success");
            setNote("");
            setFile(null);
            await load();
        } catch (e) {
            toast(tp("page.krankenbescheinigung.toast.save_failed", { error: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    }

    async function handleEnd(id: string) {
        setBusy(true);
        try {
            await endKrankenbescheinigung(id);
            toast(t("page.krankenbescheinigung.toast.ended"), "success");
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
        <div className="praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                title={t("page.krankenbescheinigung.title")}
                subtitle={t("page.krankenbescheinigung.subtitle")}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: "start" }}>
                <Card>
                    <CardHeader title={t("page.krankenbescheinigung.form.new")} />
                    <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <Select
                            id="kb-personal"
                            label={t("page.krankenbescheinigung.label.staff")}
                            value={personalId}
                            onChange={(e) => setPersonalId(e.target.value)}
                            options={staffOptions}
                        />
                        <Input id="kb-from" type="date" label={t("page.krankenbescheinigung.label.from")} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        <Input id="kb-to" type="date" label={t("page.krankenbescheinigung.label.to_optional")} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        <Textarea id="kb-note" label={t("page.krankenbescheinigung.label.note")} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                        <label style={{ fontSize: 13 }}>
                            {t("page.krankenbescheinigung.label.document")}
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                style={{ display: "block", marginTop: 4 }}
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            />
                            {file ? <span style={{ color: "var(--fg-3)" }}>{file.name}</span> : null}
                        </label>
                        <Button type="button" disabled={!file || !personalId || busy} loading={busy} onClick={() => void handleSave()}>
                            {t("page.krankenbescheinigung.save")}
                        </Button>
                    </div>
                </Card>

                <Card>
                    <CardHeader title={t("page.krankenbescheinigung.entries")} />
                    <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflow: "auto" }}>
                        {records.length === 0 ? (
                            <p style={{ margin: 0, color: "var(--fg-3)" }}>{t("page.krankenbescheinigung.empty")}</p>
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
                                        <strong>{personal.find((p) => p.id === r.personalId)?.name ?? r.personalId}</strong>
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
                    <CardHeader title={t("page.krankenbescheinigung.detail")} />
                    <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <p style={{ margin: 0 }}>
                            <strong>{t("page.krankenbescheinigung.period")}</strong> {selected.dateFrom}
                            {selected.dateTo ? ` – ${selected.dateTo}` : ""}
                        </p>
                        {selected.note ? <p style={{ margin: 0 }}>{selected.note}</p> : null}
                        <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>
                            {tp("page.krankenbescheinigung.created", {
                                datetime: format(parseISO(selected.createdAt), "dd.MM.yyyy HH:mm", { locale: dateFnsLocale }),
                            })}
                        </p>
                        {selected.status === "ACTIVE" ? (
                            <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleEnd(selected.id)}>
                                {t("page.krankenbescheinigung.end")}
                            </Button>
                        ) : null}
                    </div>
                </Card>
                </div>
            ) : null}
        </div>
    );
}
