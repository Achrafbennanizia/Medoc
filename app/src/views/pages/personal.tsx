import { useCallback, useEffect, useState } from "react";
import { listPersonal, createPersonal } from "../../controllers/personal.controller";
import { errorMessage } from "../../lib/utils";
import type { Personal } from "../../models/types";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog } from "../components/ui/dialog";
import { Input, Select } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

export function PersonalPage() {
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
    const toast = useToastStore((s) => s.add);

    const load = useCallback(async (opts?: { initial?: boolean }) => {
        const isInitial = opts?.initial === true;
        if (isInitial) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const data = await listPersonal();
            setPersonal(data);
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
        await createPersonal(form);
        toast("Mitarbeiter erstellt");
        setShowCreate(false);
        setForm({ name: "", email: "", passwort: "", rolle: "REZEPTION" });
        void load();
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline text-on-primary">Personal</h2>
                <Button onClick={() => setShowCreate(true)}>+ Neuer Mitarbeiter</Button>
            </div>

            {loading ? (
                <PageLoading label="Personal wird geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            ) : personal.length === 0 ? (
                <EmptyState icon="👤" title="Kein Personal vorhanden" />
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Name</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">E-Mail</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Rolle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {personal.map((p) => (
                                <tr key={p.id} className="border-b border-surface-container/50 hover:bg-surface-container/50 transition-colors">
                                    <td className="px-4 py-3 text-on-primary font-medium">{p.name}</td>
                                    <td className="px-4 py-3 text-on-surface">{p.email}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant="purple">{p.rolle}</Badge>
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
                title="Neuer Mitarbeiter"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
                        <Button onClick={handleCreate} disabled={!form.name || !form.email || !form.passwort}>Erstellen</Button>
                    </>
                }
            >
                <Input id="pers-name" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input id="pers-email" type="email" label="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Input id="pers-passwort" type="password" label="Passwort" value={form.passwort} onChange={(e) => setForm({ ...form, passwort: e.target.value })} />
                <Select
                    id="pers-rolle"
                    label="Rolle"
                    value={form.rolle}
                    onChange={(e) => setForm({ ...form, rolle: e.target.value })}
                    options={[
                        { value: "ARZT", label: "Arzt" },
                        { value: "REZEPTION", label: "Rezeption" },
                        { value: "STEUERBERATER", label: "Steuerberater" },
                        { value: "PHARMABERATER", label: "Pharmaberater" },
                    ]}
                />
            </Dialog>
        </div>
    );
}
