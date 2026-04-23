import { useCallback, useEffect, useState } from "react";
import { listLeistungen, createLeistung, deleteLeistung } from "../../controllers/leistung.controller";
import { errorMessage, formatCurrency } from "../../lib/utils";
import type { Leistung } from "../../models/types";
import { Button } from "../components/ui/button";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { Input, Textarea } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

export function LeistungenPage() {
    const [leistungen, setLeistungen] = useState<Leistung[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", kategorie: "", preis: "", beschreibung: "" });
    const toast = useToastStore((s) => s.add);

    const load = useCallback(async (opts?: { initial?: boolean }) => {
        const isInitial = opts?.initial === true;
        if (isInitial) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const data = await listLeistungen();
            setLeistungen(data);
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
        await createLeistung({ name: form.name, kategorie: form.kategorie, preis: Number(form.preis), beschreibung: form.beschreibung || undefined });
        toast("Leistung erstellt");
        setShowCreate(false);
        setForm({ name: "", kategorie: "", preis: "", beschreibung: "" });
        void load();
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        await deleteLeistung(deleteId);
        toast("Leistung gelöscht");
        setDeleteId(null);
        void load();
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline text-on-primary">Leistungen</h2>
                <Button onClick={() => setShowCreate(true)}>+ Neue Leistung</Button>
            </div>

            {loading ? (
                <PageLoading label="Leistungen werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : leistungen.length === 0 ? (
                <EmptyState icon="🦷" title="Keine Leistungen vorhanden" />
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Name</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Kategorie</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Preis</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Beschreibung</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leistungen.map((l) => (
                                <tr key={l.id} className="border-b border-surface-container/50 hover:bg-surface-container/50 transition-colors">
                                    <td className="px-4 py-3 text-on-primary font-medium">{l.name}</td>
                                    <td className="px-4 py-3 text-on-surface">{l.kategorie}</td>
                                    <td className="px-4 py-3 text-right text-accent-green">{formatCurrency(l.preis)}</td>
                                    <td className="px-4 py-3 text-on-surface-variant">{l.beschreibung || "–"}</td>
                                    <td className="px-4 py-3 text-right">
                                        <Button variant="danger" size="sm" onClick={() => setDeleteId(l.id)}>Löschen</Button>
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
                title="Neue Leistung"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
                        <Button onClick={handleCreate} disabled={!form.name || !form.kategorie || !form.preis}>Erstellen</Button>
                    </>
                }
            >
                <Input id="leistung-name" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input id="leistung-kat" label="Kategorie" value={form.kategorie} onChange={(e) => setForm({ ...form, kategorie: e.target.value })} />
                <Input id="leistung-preis" type="number" label="Preis (€)" value={form.preis} onChange={(e) => setForm({ ...form, preis: e.target.value })} />
                <Textarea id="leistung-beschr" label="Beschreibung" value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} />
            </Dialog>

            <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Leistung löschen" message="Möchten Sie diese Leistung wirklich löschen?" confirmLabel="Löschen" danger />
        </div>
    );
}
