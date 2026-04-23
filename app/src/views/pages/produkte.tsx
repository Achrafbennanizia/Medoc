import { useCallback, useEffect, useState } from "react";
import { listProdukte, createProdukt, deleteProdukt } from "../../controllers/produkt.controller";
import { errorMessage, formatCurrency } from "../../lib/utils";
import type { Produkt } from "../../models/types";
import { Button } from "../components/ui/button";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { Input, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

export function ProduktePage() {
    const [produkte, setProdukte] = useState<Produkt[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", kategorie: "", preis: "", bestand: "", mindestbestand: "", beschreibung: "" });
    const toast = useToastStore((s) => s.add);

    const load = useCallback(async (opts?: { initial?: boolean }) => {
        const isInitial = opts?.initial === true;
        if (isInitial) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const data = await listProdukte();
            setProdukte(data);
        } catch (e) {
            const msg = errorMessage(e);
            if (isInitial) setLoadError(msg);
            else toast(`Aktualisieren fehlgeschlagen: ${msg}`);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    const handleCreate = async () => {
        await createProdukt({
            name: form.name, kategorie: form.kategorie, preis: Number(form.preis),
            bestand: Number(form.bestand), mindestbestand: Number(form.mindestbestand), beschreibung: form.beschreibung || undefined,
        });
        toast("Produkt erstellt");
        setShowCreate(false);
        setForm({ name: "", kategorie: "", preis: "", bestand: "", mindestbestand: "", beschreibung: "" });
        void load();
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        await deleteProdukt(deleteId);
        toast("Produkt gelöscht");
        setDeleteId(null);
        void load();
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline text-on-primary">Produkte</h2>
                <Button onClick={() => setShowCreate(true)}>+ Neues Produkt</Button>
            </div>

            {loading ? (
                <PageLoading label="Produkte werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : produkte.length === 0 ? (
                <EmptyState icon="📦" title="Keine Produkte vorhanden" />
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Name</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Kategorie</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Preis</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Bestand</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {produkte.map((p) => (
                                <tr key={p.id} className="border-b border-surface-container/50 hover:bg-surface-container/50 transition-colors">
                                    <td className="px-4 py-3 text-on-primary font-medium">{p.name}</td>
                                    <td className="px-4 py-3 text-on-surface">{p.kategorie}</td>
                                    <td className="px-4 py-3 text-right text-accent-green">{formatCurrency(p.preis)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {p.bestand <= p.mindestbestand ? (
                                            <Badge variant="error">{p.bestand} / {p.mindestbestand}</Badge>
                                        ) : (
                                            <span className="text-on-surface">{p.bestand}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button variant="danger" size="sm" onClick={() => setDeleteId(p.id)}>Löschen</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                title="Neues Produkt"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
                        <Button onClick={handleCreate} disabled={!form.name || !form.kategorie || !form.preis}>Erstellen</Button>
                    </>
                }
            >
                <Input id="prod-name" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input id="prod-kat" label="Kategorie" value={form.kategorie} onChange={(e) => setForm({ ...form, kategorie: e.target.value })} />
                <Input id="prod-preis" type="number" label="Preis (€)" value={form.preis} onChange={(e) => setForm({ ...form, preis: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                    <Input id="prod-bestand" type="number" label="Bestand" value={form.bestand} onChange={(e) => setForm({ ...form, bestand: e.target.value })} />
                    <Input id="prod-mindest" type="number" label="Mindestbestand" value={form.mindestbestand} onChange={(e) => setForm({ ...form, mindestbestand: e.target.value })} />
                </div>
                <Textarea id="prod-beschr" label="Beschreibung" value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} />
            </Dialog>

            <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Produkt löschen" message="Möchten Sie dieses Produkt wirklich löschen?" confirmLabel="Löschen" danger />
        </div>
    );
}
