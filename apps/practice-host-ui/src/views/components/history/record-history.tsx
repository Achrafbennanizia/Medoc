/**
 * History of a record or a patient (T5.8): who changed what, on which device, when.
 * Duo and Cabinet+ only; callers render it behind `__CAP_MULTI_STAFF__`.
 */
import { useCallback, useEffect, useState } from "react";
import { translateLocaleWithFallback, useLocale, useT, useTParams } from "@/lib/i18n";
import { errorMessage, formatDateTime } from "@/lib/utils";
import {
    historyForPatient,
    historyForRecord,
    type HistoryEntry,
    type HistoryList,
    type HistoryTable,
} from "@/systems/practice-host/controllers/history.controller";
import { changeTexts, humanizeField } from "./record-history-format";

function useHistory(load: () => Promise<HistoryList>) {
    const [data, setData] = useState<HistoryList | null>(null);
    const [error, setError] = useState<string | null>(null);
    const reload = useCallback(() => {
        setError(null);
        load()
            .then(setData)
            .catch((e: unknown) => setError(errorMessage(e)));
    }, [load]);
    useEffect(reload, [reload]);
    return { data, error, reload };
}

function HistoryEntryItem({ entry, showTable }: { entry: HistoryEntry; showTable: boolean }) {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const who =
        entry.actorName ??
        (entry.actorStaffId === "system"
            ? t("history.system")
            : entry.actorStaffId || t("history.unknown_author"));
    const fieldLabel = (field: string) =>
        translateLocaleWithFallback(locale, `history.field.${field}`, humanizeField(field));
    return (
        <li className="record-history__item">
            <div className="record-history__head">
                <span className="record-history__op">{t(`history.op.${entry.op}`)}</span>
                {showTable ? (
                    <span className="record-history__table">{t(`history.table.${entry.table}`)}</span>
                ) : null}
                <span className="record-history__meta">
                    {who}
                    {" · "}
                    {tp("history.on_device", { device: entry.deviceLabel || entry.deviceId.slice(0, 8) })}
                    {" · "}
                    <time dateTime={entry.at}>{formatDateTime(entry.at, locale)}</time>
                </span>
            </div>
            {entry.changes.length > 0 ? (
                <dl className="record-history__changes">
                    {entry.changes.map((c) => {
                        const { old, next } = changeTexts(c);
                        return (
                            <div key={c.field} className="record-history__change">
                                <dt>{fieldLabel(c.field)}</dt>
                                <dd>
                                    {entry.op === "UPDATE" ? (
                                        <>
                                            <span className="record-history__old">{old ?? "—"}</span>
                                            <span aria-hidden> → </span>
                                            <span className="sr-only">{t("history.changed_to")}</span>
                                        </>
                                    ) : null}
                                    <span className="record-history__new">{next ?? "—"}</span>
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            ) : null}
        </li>
    );
}

function HistoryBody({
    data,
    error,
    reload,
    showTable,
}: ReturnType<typeof useHistory> & { showTable: boolean }) {
    const t = useT();
    const tp = useTParams();
    if (error) {
        return (
            <p className="record-history__status" role="alert">
                {t("history.load_failed")}{" "}
                <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
                    {t("common.retry")}
                </button>
            </p>
        );
    }
    if (!data) return <p className="record-history__status">{t("history.loading")}</p>;
    const hidden = data.hiddenDoctors ?? [];
    return (
        <>
            {hidden.length > 0 ? (
                <p className="card-sub" role="status">
                    {tp("history.not_shared_by", { names: hidden.join(", ") })}
                </p>
            ) : null}
            {data.items.length === 0 ? (
                <p className="record-history__status">{t("history.empty")}</p>
            ) : (
                <ol className="record-history">
                    {data.items.map((e) => (
                        <HistoryEntryItem key={e.id} entry={e} showTable={showTable} />
                    ))}
                </ol>
            )}
        </>
    );
}

/** Collapsible History section for a detail drawer (task, order, payment, appointment). */
export function RecordHistory({ table, entityId }: { table: HistoryTable; entityId: string }) {
    const t = useT();
    const [open, setOpen] = useState(false);
    return (
        <details className="record-history-section" onToggle={(e) => setOpen(e.currentTarget.open)}>
            <summary>{t("history.title")}</summary>
            {open ? <RecordHistoryLoaded table={table} entityId={entityId} /> : null}
        </details>
    );
}

function RecordHistoryLoaded({ table, entityId }: { table: HistoryTable; entityId: string }) {
    const load = useCallback(() => historyForRecord(table, entityId), [table, entityId]);
    const state = useHistory(load);
    return <HistoryBody {...state} showTable={false} />;
}

/** Patient record → History tab: every change in records this person may read. */
export function PatientHistoryPanel({ patientId }: { patientId: string }) {
    const t = useT();
    const load = useCallback(() => historyForPatient(patientId), [patientId]);
    const state = useHistory(load);
    return (
        <section className="card" aria-labelledby="patient-history-title">
            <h2 id="patient-history-title" className="card-title">
                {t("history.title")}
            </h2>
            <p className="card-sub">{t("history.patient_hint")}</p>
            <HistoryBody {...state} showTable />
        </section>
    );
}
