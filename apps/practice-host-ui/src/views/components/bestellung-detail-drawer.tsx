import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import type { Produkt } from "@/models/types";
import {
    deleteBestellung,
    updateBestellung,
    updateBestellungStatus,
    type Bestellung,
    type BestellStatus,
} from "@/systems/practice-host/controllers/bestellung.controller";
import { listProdukte } from "@/systems/practice-host/controllers/produkt.controller";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import { bestellStatusDisplay, bestellStatusOptions } from "@/lib/finance-order-labels";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { EditIcon, XIcon } from "@/lib/icons";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/dialog";
import { Input, Select, Textarea } from "./ui/input";
import { useToastStore } from "./ui/toast-store";

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function isOverdue(b: Bestellung): boolean {
    if (!b.erwartet_am) return false;
    if (b.status === "GELIEFERT" || b.status === "STORNIERT") return false;
    return b.erwartet_am < todayISO();
}

function statusPill(status: BestellStatus, overdue: boolean, t: (key: string) => string): { className: string; label: string } {
    if (overdue) return { className: "pill orange", label: t("page.bestellungen.status.ueberfaellig") };
    const st = bestellStatusDisplay(status, t);
    switch (status) {
        case "OFFEN":
            return { className: "pill grey", label: st.label };
        case "UNTERWEGS":
            return { className: "pill blue", label: st.label };
        case "GELIEFERT":
            return { className: "pill green", label: st.label };
        case "STORNIERT":
            return { className: "pill grey", label: st.label };
    }
}

interface EditDraft {
    lieferant: string;
    pharmaberater: string;
    artikel: string;
    menge: string;
    einheit: string;
    erwartet_am: string;
    bemerkung: string;
}

function draftFromBestellung(b: Bestellung): EditDraft {
    return {
        lieferant: b.lieferant,
        pharmaberater: b.pharmaberater ?? "",
        artikel: b.artikel,
        menge: String(b.menge),
        einheit: b.einheit ?? "",
        erwartet_am: b.erwartet_am ?? "",
        bemerkung: b.bemerkung ?? "",
    };
}

export type BestellungDetailDrawerProps = {
    bestellung: Bestellung;
    canWrite: boolean;
    canAddProdukt: boolean;
    onClose: () => void;
    onUpdated: (b: Bestellung) => void;
    onDeleted: (id: string) => void;
};

export function BestellungDetailDrawer({
    bestellung,
    canWrite,
    canAddProdukt,
    onClose,
    onUpdated,
    onDeleted,
}: BestellungDetailDrawerProps) {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<EditDraft | null>(null);
    const [saveBusy, setSaveBusy] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [statusBusy, setStatusBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [produkte, setProdukte] = useState<Produkt[]>([]);

    const statusOptions = useMemo(() => bestellStatusOptions(t), [t]);
    const overdue = useMemo(() => isOverdue(bestellung), [bestellung]);
    const pill = statusPill(bestellung.status, overdue, t);

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        queueMicrotask(() => {
            panelRef.current?.querySelector<HTMLButtonElement>(".termin-drawer-head .icon-btn")?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    useEffect(() => {
        setEditing(false);
        setDraft(null);
        setSaveError(null);
    }, [bestellung.id]);

    const loadProdukte = useCallback(async () => {
        try {
            const list = await listProdukte();
            setProdukte(list);
        } catch {
            setProdukte([]);
        }
    }, []);

    const produkteSorted = useMemo(
        () => [...produkte].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [produkte],
    );

    const artikelProduktValue = useMemo(() => {
        if (!draft) return "";
        const p = produkte.find((x) => x.name === draft.artikel);
        if (p) return p.id;
        if (draft.artikel.trim()) return "__legacy";
        return "";
    }, [draft, produkte]);

    const artikelProduktOptionsEdit = useMemo(() => {
        const base = produkteSorted.map((p) => ({ value: p.id, label: `${p.name} · ${p.kategorie}` }));
        if (!draft) {
            return [{ value: "", label: t("drawer.bestellung.pick_product") }, ...base];
        }
        const hasMatch = produkte.some((p) => p.name === draft.artikel);
        if (!hasMatch && draft.artikel.trim()) {
            return [
                { value: "", label: t("drawer.bestellung.pick_product") },
                {
                    value: "__legacy",
                    label: tp("drawer.bestellung.product_legacy", { name: draft.artikel }),
                },
                ...base,
            ];
        }
        return [{ value: "", label: t("drawer.bestellung.pick_product") }, ...base];
    }, [produkteSorted, produkte, draft, t, tp]);

    function goNeuesProdukt() {
        const returnTo = `/bestellungen?bestellung=${bestellung.id}`;
        const params = new URLSearchParams();
        params.set("neu", "1");
        params.set("returnTo", returnTo);
        navigate(`/produkte?${params.toString()}`);
    }

    async function startEdit() {
        await loadProdukte();
        setDraft(draftFromBestellung(bestellung));
        setSaveError(null);
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setDraft(null);
        setSaveError(null);
    }

    async function saveEdit() {
        if (!draft) return;
        const menge = Number(draft.menge);
        if (!draft.lieferant.trim()) {
            setSaveError(t("drawer.bestellung.validation_lieferant"));
            return;
        }
        if (!draft.artikel.trim()) {
            setSaveError(t("drawer.bestellung.validation_artikel"));
            return;
        }
        if (!Number.isFinite(menge) || menge <= 0) {
            setSaveError(t("drawer.bestellung.validation_menge"));
            return;
        }

        setSaveBusy(true);
        setSaveError(null);
        try {
            const updated = await updateBestellung(bestellung.id, {
                lieferant: draft.lieferant.trim(),
                artikel: draft.artikel.trim(),
                menge,
                einheit: draft.einheit.trim() || null,
                erwartet_am: draft.erwartet_am || null,
                bemerkung: draft.bemerkung.trim() || null,
                pharmaberater: draft.pharmaberater.trim() || null,
            });
            onUpdated(updated);
            setEditing(false);
            setDraft(null);
            toast(t("drawer.bestellung.toast_saved"), "success");
        } catch (e) {
            setSaveError(errorMessage(e));
        } finally {
            setSaveBusy(false);
        }
    }

    async function changeStatus(next: BestellStatus) {
        if (bestellung.status === next) return;
        const previous = bestellung.status;
        setStatusBusy(true);
        try {
            const updated = await updateBestellungStatus(bestellung.id, next);
            onUpdated(updated);
            toast(
                tp("drawer.bestellung.toast_status", {
                    from: bestellStatusDisplay(previous, t).label,
                    to: bestellStatusDisplay(next, t).label,
                }),
                "success",
            );
        } catch (e) {
            toast(tp("drawer.bestellung.toast_status_failed", { message: errorMessage(e) }), "error");
        } finally {
            setStatusBusy(false);
        }
    }

    async function handleDelete() {
        try {
            await deleteBestellung(bestellung.id);
            toast(t("drawer.bestellung.toast_deleted"), "success");
            onDeleted(bestellung.id);
            onClose();
        } catch (e) {
            toast(tp("drawer.bestellung.toast_delete_failed", { message: errorMessage(e) }), "error");
        } finally {
            setConfirmDelete(false);
        }
    }

    const betragLabel =
        bestellung.gesamtbetrag != null && Number.isFinite(bestellung.gesamtbetrag)
            ? formatCurrency(bestellung.gesamtbetrag)
            : "—";

    const layer = (
        <>
            <div className="termin-drawer-head">
                <span className={pill.className}>{pill.label}</span>
                <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
                    <XIcon size={18} />
                </button>
            </div>

            <div className="termin-drawer-section">
                <div className="termin-drawer-eyebrow">{t("drawer.bestellung.eyebrow")}</div>
                <h2 id={titleId} className="termin-drawer-title">
                    {bestellung.bestellnummer ?? "—"}
                </h2>
                <div className="termin-drawer-sub">
                    {bestellung.artikel} · {bestellung.lieferant}
                </div>
            </div>

            <div className="termin-drawer-meta-row">
                <div>
                    <div className="termin-drawer-eyebrow">{t("common.expected")}</div>
                    <div
                        className="termin-drawer-meta-val"
                        style={overdue ? { color: "var(--red)" } : undefined}
                    >
                        {bestellung.erwartet_am ? formatDate(bestellung.erwartet_am) : "—"}
                    </div>
                </div>
                <div>
                    <div className="termin-drawer-eyebrow">{t("common.quantity")}</div>
                    <div className="termin-drawer-meta-val">
                        {bestellung.menge}
                        {bestellung.einheit ? ` ${bestellung.einheit}` : ""}
                    </div>
                </div>
                <div>
                    <div className="termin-drawer-eyebrow">{t("common.amount")}</div>
                    <div className="termin-drawer-meta-val">{betragLabel}</div>
                </div>
            </div>

            {canWrite && !editing ? (
                <div className="termin-drawer-section">
                    <div className="termin-drawer-eyebrow">{t("drawer.bestellung.status_workflow")}</div>
                    <div className="bestellung-drawer-workflow">
                        {statusOptions.map((opt) => {
                            const active = opt.value === bestellung.status;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`btn ${active ? "btn-accent" : "btn-subtle"}`}
                                    onClick={() => void changeStatus(opt.value)}
                                    disabled={statusBusy || active}
                                    aria-pressed={active}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                    {overdue ? (
                        <p className="bestellung-drawer-overdue-hint">{t("drawer.bestellung.overdue_hint")}</p>
                    ) : null}
                </div>
            ) : null}

            <div className="termin-drawer-section">
                <div className="termin-drawer-eyebrow">
                    {editing ? t("drawer.bestellung.edit_data") : t("drawer.bestellung.order_data")}
                </div>
                {editing && draft ? (
                    <div className="bestellung-drawer-edit">
                        {saveError ? <p className="bestellung-drawer-save-error">{saveError}</p> : null}
                        <Input
                            id="bdrawer-lief"
                            label={t("common.supplier")}
                            value={draft.lieferant}
                            onChange={(e) => setDraft({ ...draft, lieferant: e.target.value })}
                        />
                        <Input
                            id="bdrawer-pharma"
                            label={t("drawer.bestellung.contact")}
                            value={draft.pharmaberater}
                            onChange={(e) => setDraft({ ...draft, pharmaberater: e.target.value })}
                        />
                        <div className="bestellung-drawer-edit-artikel">
                            <Select
                                id="bdrawer-art"
                                label={t("drawer.bestellung.article_product")}
                                value={artikelProduktValue}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") {
                                        setDraft({ ...draft, artikel: "" });
                                        return;
                                    }
                                    if (v === "__legacy") return;
                                    const p = produkte.find((x) => x.id === v);
                                    if (p) setDraft({ ...draft, artikel: p.name });
                                }}
                                options={artikelProduktOptionsEdit}
                            />
                            {canAddProdukt ? (
                                <Button type="button" variant="secondary" size="sm" onClick={goNeuesProdukt}>
                                    {t("drawer.bestellung.new_product")}
                                </Button>
                            ) : null}
                        </div>
                        <div className="bestellung-drawer-edit-grid">
                            <Input
                                id="bdrawer-menge"
                                label={t("common.quantity")}
                                type="number"
                                min={1}
                                value={draft.menge}
                                onChange={(e) => setDraft({ ...draft, menge: e.target.value })}
                            />
                            <Input
                                id="bdrawer-einheit"
                                label={t("common.unit")}
                                value={draft.einheit}
                                onChange={(e) => setDraft({ ...draft, einheit: e.target.value })}
                            />
                        </div>
                        <Input
                            id="bdrawer-erw"
                            label={t("common.expected_on")}
                            type="date"
                            value={draft.erwartet_am}
                            onChange={(e) => setDraft({ ...draft, erwartet_am: e.target.value })}
                        />
                        <Textarea
                            id="bdrawer-bem"
                            label={t("common.note")}
                            rows={3}
                            value={draft.bemerkung}
                            onChange={(e) => setDraft({ ...draft, bemerkung: e.target.value })}
                        />
                    </div>
                ) : (
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("common.supplier")}</div>
                            <div className="termin-drawer-meta-val">{bestellung.lieferant}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("drawer.bestellung.contact")}</div>
                            <div className="termin-drawer-meta-val">{bestellung.pharmaberater ?? "—"}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("common.article")}</div>
                            <div className="termin-drawer-meta-val">{bestellung.artikel}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("common.delivered_on")}</div>
                            <div className="termin-drawer-meta-val">
                                {bestellung.geliefert_am ? formatDate(bestellung.geliefert_am) : "—"}
                            </div>
                        </div>
                        {(bestellung.bemerkung ?? "").trim() ? (
                            <div className="ios-row">
                                <div className="termin-drawer-eyebrow">{t("common.note")}</div>
                                <div className="termin-drawer-meta-val termin-drawer-meta-val--pre">
                                    {bestellung.bemerkung}
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {!editing ? (
                <div className="termin-drawer-section">
                    <div className="termin-drawer-eyebrow">{t("common.metadata")}</div>
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("common.status")}</div>
                            <div className="termin-drawer-meta-val">{bestellStatusDisplay(bestellung.status, t).label}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("common.created_at")}</div>
                            <div className="termin-drawer-meta-val">
                                {format(parseISO(bestellung.created_at), "d. MMM yyyy, HH:mm", { locale: dateFnsLocale })}
                            </div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("common.updated_at")}</div>
                            <div className="termin-drawer-meta-val">
                                {format(parseISO(bestellung.updated_at), "d. MMM yyyy, HH:mm", { locale: dateFnsLocale })}
                            </div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">{t("common.created_by")}</div>
                            <div className="termin-drawer-meta-val termin-drawer-meta-val--mono">
                                {bestellung.created_by}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {canWrite ? (
                <div className="termin-drawer-panel-foot">
                    <div className="termin-drawer-actions row">
                        {editing ? (
                            <>
                                <Button variant="ghost" onClick={cancelEdit} disabled={saveBusy}>
                                    {t("common.cancel")}
                                </Button>
                                <Button onClick={() => void saveEdit()} loading={saveBusy} disabled={saveBusy}>
                                    {t("common.save")}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => void startEdit()}>
                                    <EditIcon />
                                    {t("common.edit")}
                                </Button>
                                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                                    {t("common.delete")}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            ) : null}

            <ConfirmDialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                onConfirm={handleDelete}
                title={t("drawer.bestellung.delete_title")}
                message={tp("drawer.bestellung.delete_confirm", {
                    num: bestellung.bestellnummer ?? "",
                })}
                confirmLabel={t("common.delete")}
                danger
            />
        </>
    );

    return createPortal(
        <div className="termin-drawer-root" role="presentation">
            <button type="button" className="termin-drawer-backdrop" aria-label={t("common.close")} onClick={onClose} />
            <div
                ref={panelRef}
                className="termin-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="termin-drawer-body-scroll">{layer}</div>
            </div>
        </div>,
        document.body,
    );
}
