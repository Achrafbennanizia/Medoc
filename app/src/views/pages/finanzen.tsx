import { useCallback, useEffect, useState } from "react";
import { listZahlungen, createZahlung, updateZahlungStatus } from "../../controllers/zahlung.controller";
import { renderInvoicePdf } from "../../controllers/invoice.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { listLeistungen } from "../../controllers/leistung.controller";
import { parseRole, allowed } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import { errorMessage, formatCurrency } from "../../lib/utils";
import type { Zahlung, Patient, Leistung, ZahlungsStatus } from "../../models/types";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Select, Input, Textarea } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

const ZAHLUNG_STATUS_OPTIONS: readonly { value: ZahlungsStatus; label: string }[] = [
    { value: "AUSSTEHEND", label: "Ausstehend" },
    { value: "BEZAHLT", label: "Bezahlt" },
    { value: "TEILBEZAHLT", label: "Teilbezahlt" },
    { value: "STORNIERT", label: "Storniert" },
];

export function FinanzenPage() {
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWriteZahlung = role != null && allowed("finanzen.write", role);
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [leistungen, setLeistungen] = useState<Leistung[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showInvoice, setShowInvoice] = useState(false);
    const [invBusy, setInvBusy] = useState(false);
    const [invoiceForm, setInvoiceForm] = useState({
        patient_id: "",
        number: "",
        date: new Date().toISOString().slice(0, 10),
        practice_name: "Zahnarztpraxis",
        practice_addr: "Musterstraße 1\n12345 Ort",
        line_desc: "Zahnärztliche Leistung",
        line_eur: "",
        note: "",
    });
    const [form, setForm] = useState({ patient_id: "", leistung_id: "", zahlungsart: "BAR", betrag: "" });
    const [createBusy, setCreateBusy] = useState(false);
    const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
    const [listLoading, setListLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const toast = useToastStore((s) => s.add);

    const load = useCallback(async (opts?: { initial?: boolean }) => {
        const isInitial = opts?.initial === true;
        if (isInitial) {
            setListLoading(true);
            setLoadError(null);
        }
        try {
            const [z, p, l] = await Promise.all([listZahlungen(), listPatienten(), listLeistungen()]);
            setZahlungen(z);
            setPatienten(p);
            setLeistungen(l);
        } catch (e) {
            const msg = errorMessage(e);
            if (isInitial) {
                setLoadError(msg);
            } else {
                toast(`Aktualisieren fehlgeschlagen: ${msg}`);
            }
        } finally {
            if (isInitial) setListLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    const einnahmen = zahlungen.filter((z) => z.status === "BEZAHLT").reduce((s, z) => s + z.betrag, 0);
    const ausstehend = zahlungen.filter((z) => z.status === "AUSSTEHEND").reduce((s, z) => s + z.betrag, 0);

    if (listLoading) {
        return (
            <div className="animate-fade-in">
                <h2 className="text-headline text-on-primary mb-6">Finanzen</h2>
                <PageLoading label="Zahlungsdaten werden geladen…" />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="animate-fade-in">
                <h2 className="text-headline text-on-primary mb-6">Finanzen</h2>
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            </div>
        );
    }

    const handleStatusChange = async (z: Zahlung, status: ZahlungsStatus) => {
        if (status === z.status) return;
        setStatusUpdatingId(z.id);
        try {
            const updated = await updateZahlungStatus(z.id, status);
            setZahlungen((list) => list.map((row) => (row.id === updated.id ? updated : row)));
            toast("Status aktualisiert");
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setStatusUpdatingId(null);
        }
    };

    const handleInvoicePdf = async () => {
        const p = patienten.find((x) => x.id === invoiceForm.patient_id);
        if (!p) {
            toast("Bitte einen Patienten wählen.");
            return;
        }
        const amountEur = Number(String(invoiceForm.line_eur).replace(",", "."));
        const amountCents = Math.round(amountEur * 100);
        if (!Number.isFinite(amountCents) || amountCents <= 0) {
            toast("Bitte einen gültigen Betrag in EUR eingeben.");
            return;
        }
        const num = invoiceForm.number.trim() || `RE-${invoiceForm.date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        setInvBusy(true);
        try {
            const bytes = await renderInvoicePdf({
                number: num,
                date: invoiceForm.date,
                recipient_name: p.name,
                recipient_address: p.adresse
                    ? p.adresse.split("\n").map((s) => s.trim()).filter(Boolean)
                    : ["–"],
                practice_name: invoiceForm.practice_name.trim(),
                practice_address: invoiceForm.practice_addr.split("\n").map((s) => s.trim()).filter(Boolean),
                lines: [{ description: invoiceForm.line_desc.trim() || "Leistung", amount_cents: amountCents }],
                note: invoiceForm.note.trim() || null,
            });
            const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `rechnung-${num.replace(/[^\w.-]+/g, "_")}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast("Rechnungs-PDF erzeugt.");
            setShowInvoice(false);
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setInvBusy(false);
        }
    };

    const handleCreate = async () => {
        setCreateBusy(true);
        try {
            await createZahlung({
                patient_id: form.patient_id,
                betrag: Number(form.betrag),
                zahlungsart: form.zahlungsart,
                leistung_id: form.leistung_id || undefined,
            });
            toast("Zahlung erstellt");
            setShowCreate(false);
            setForm({ patient_id: "", leistung_id: "", zahlungsart: "BAR", betrag: "" });
            await load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setCreateBusy(false);
        }
    };

    const bilanzCards = [
        { label: "Einnahmen", value: formatCurrency(einnahmen), accent: "text-accent-green" },
        { label: "Ausstehend", value: formatCurrency(ausstehend), accent: "text-accent-yellow" },
        { label: "Zahlungen", value: String(zahlungen.length), accent: "text-primary" },
    ];

    return (
        <div className="animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h2 className="text-headline text-on-primary">Finanzen</h2>
                <div className="flex flex-wrap gap-2">
                    {canWriteZahlung ? (
                        <>
                            <Button variant="ghost" onClick={() => setShowInvoice(true)}>Rechnung als PDF</Button>
                            <Button onClick={() => setShowCreate(true)}>+ Neue Zahlung</Button>
                        </>
                    ) : null}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {bilanzCards.map((c) => (
                    <Card key={c.label}>
                        <div className="text-body text-on-surface-variant">{c.label}</div>
                        <div className={`text-headline mt-1 ${c.accent}`}>{c.value}</div>
                    </Card>
                ))}
            </div>

            {zahlungen.length === 0 ? (
                <EmptyState icon="💰" title="Keine Zahlungen vorhanden" />
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Betrag</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Art</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Status</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Notizen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {zahlungen.map((z) => (
                                <tr key={z.id} className="border-b border-surface-container/50 hover:bg-surface-container/50 transition-colors">
                                    <td className="px-4 py-3 text-on-primary font-medium">{formatCurrency(z.betrag)}</td>
                                    <td className="px-4 py-3 text-on-surface">{z.zahlungsart}</td>
                                    <td className="px-4 py-3">
                                        <Select
                                            id={`zahlung-status-${z.id}`}
                                            className="max-w-[13rem] text-caption h-8"
                                            aria-label={`Zahlungsstatus (${formatCurrency(z.betrag)})`}
                                            value={z.status}
                                            disabled={!canWriteZahlung || statusUpdatingId === z.id}
                                            onChange={(e) =>
                                                handleStatusChange(z, e.target.value as ZahlungsStatus)
                                            }
                                            options={ZAHLUNG_STATUS_OPTIONS.map((o) => ({
                                                value: o.value,
                                                label: o.label,
                                            }))}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-on-surface-variant">{z.beschreibung || "–"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                title="Neue Zahlung"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
                        <Button onClick={handleCreate} disabled={createBusy || !form.patient_id || !form.betrag} loading={createBusy}>Erstellen</Button>
                    </>
                }
            >
                <Select
                    id="zahlung-patient"
                    label="Patient"
                    value={form.patient_id}
                    onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
                    options={[{ value: "", label: "– Patient wählen –" }, ...patienten.map((p) => ({ value: p.id, label: p.name }))]}
                />
                <Select
                    id="zahlung-leistung"
                    label="Leistung"
                    value={form.leistung_id}
                    onChange={(e) => setForm({ ...form, leistung_id: e.target.value })}
                    options={[{ value: "", label: "– Leistung wählen –" }, ...leistungen.map((l) => ({ value: l.id, label: `${l.name} (${formatCurrency(l.preis)})` }))]}
                />
                <Select
                    id="zahlung-art"
                    label="Zahlungsart"
                    value={form.zahlungsart}
                    onChange={(e) => setForm({ ...form, zahlungsart: e.target.value })}
                    options={[
                        { value: "BAR", label: "Bar" },
                        { value: "KARTE", label: "Karte" },
                        { value: "UEBERWEISUNG", label: "Überweisung" },
                        { value: "RECHNUNG", label: "Rechnung" },
                    ]}
                />
                <Input id="zahlung-betrag" type="number" label="Betrag (€)" value={form.betrag} onChange={(e) => setForm({ ...form, betrag: e.target.value })} />
            </Dialog>

            <Dialog
                open={showInvoice}
                onClose={() => setShowInvoice(false)}
                title="Rechnung als PDF (FA-FIN-INVOICE)"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowInvoice(false)}>Abbrechen</Button>
                        <Button onClick={() => void handleInvoicePdf()} disabled={invBusy} loading={invBusy}>PDF erzeugen</Button>
                    </>
                }
            >
                <Select
                    id="inv-patient"
                    label="Empfänger (Patient)"
                    value={invoiceForm.patient_id}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, patient_id: e.target.value })}
                    options={[{ value: "", label: "– Patient –" }, ...patienten.map((p) => ({ value: p.id, label: p.name }))]}
                />
                <Input
                    id="inv-num"
                    label="Rechnungsnummer"
                    placeholder="optional (sonst automatisch)"
                    value={invoiceForm.number}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, number: e.target.value })}
                />
                <Input
                    id="inv-date"
                    type="date"
                    label="Datum"
                    value={invoiceForm.date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                />
                <Input
                    id="inv-practice"
                    label="Praxis (Name)"
                    value={invoiceForm.practice_name}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, practice_name: e.target.value })}
                />
                <Textarea
                    id="inv-practice-addr"
                    label="Praxis (Adresse, je Zeile)"
                    value={invoiceForm.practice_addr}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, practice_addr: e.target.value })}
                />
                <Input
                    id="inv-line-desc"
                    label="Leistungsbeschreibung"
                    value={invoiceForm.line_desc}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, line_desc: e.target.value })}
                />
                <Input
                    id="inv-line-eur"
                    label="Betrag brutto (EUR)"
                    value={invoiceForm.line_eur}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, line_eur: e.target.value })}
                />
                <Input
                    id="inv-note"
                    label="Notiz auf der Rechnung"
                    value={invoiceForm.note}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, note: e.target.value })}
                />
            </Dialog>
        </div>
    );
}
