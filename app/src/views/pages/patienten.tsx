import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPatienten, searchPatienten, createPatient } from "../../controllers/patient.controller";
import { errorMessage, formatDate } from "../../lib/utils";
import type { Patient } from "../../models/types";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Dialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

const SEARCH_DEBOUNCE_MS = 320;

export function PatientenPage() {
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        name: "", geburtsdatum: "", geschlecht: "MAENNLICH",
        versicherungsnummer: "", telefon: "", email: "", adresse: "",
    });
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const q = debouncedSearch.trim();
            const data = q ? await searchPatienten(q) : await listPatienten();
            setPatienten(data);
        } catch (e) {
            setLoadError(errorMessage(e));
            setPatienten([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleCreate = async () => {
        await createPatient({
            name: form.name,
            geburtsdatum: form.geburtsdatum,
            geschlecht: form.geschlecht,
            versicherungsnummer: form.versicherungsnummer,
            telefon: form.telefon || undefined,
            email: form.email || undefined,
            adresse: form.adresse || undefined,
        });
        toast("Patient erstellt");
        setShowCreate(false);
        setForm({ name: "", geburtsdatum: "", geschlecht: "MAENNLICH", versicherungsnummer: "", telefon: "", email: "", adresse: "" });
        load();
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline text-on-primary">Patienten</h2>
                <Button onClick={() => setShowCreate(true)}>+ Neuer Patient</Button>
            </div>

            <div className="mb-4">
                <Input
                    id="search"
                    placeholder="Suche nach Name oder Versicherungsnummer..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-md"
                />
            </div>

            {loading ? (
                <PageLoading label="Patienten werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : patienten.length === 0 ? (
                <EmptyState icon="👥" title="Keine Patienten gefunden" />
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Name</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Geburtsdatum</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Versicherungs-Nr.</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Status</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Telefon</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patienten.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-b border-surface-container/50 hover:bg-surface-container/50 cursor-pointer transition-colors"
                                    onClick={() => navigate(`/patienten/${p.id}`)}
                                >
                                    <td className="px-4 py-3 text-on-primary font-medium">{p.name}</td>
                                    <td className="px-4 py-3 text-on-surface">{formatDate(p.geburtsdatum)}</td>
                                    <td className="px-4 py-3 font-mono text-caption text-on-surface-variant">{p.versicherungsnummer}</td>
                                    <td className="px-4 py-3"><Badge variant="primary">{p.status}</Badge></td>
                                    <td className="px-4 py-3 text-on-surface-variant">{p.telefon || "–"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                title="Neuer Patient"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
                        <Button onClick={handleCreate} disabled={!form.name || !form.geburtsdatum || !form.versicherungsnummer}>
                            Erstellen
                        </Button>
                    </>
                }
            >
                <div className="grid grid-cols-2 gap-4">
                    <Input id="name" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <Input id="geburtsdatum" type="date" label="Geburtsdatum" value={form.geburtsdatum} onChange={(e) => setForm({ ...form, geburtsdatum: e.target.value })} />
                </div>
                <Select
                    id="geschlecht"
                    label="Geschlecht"
                    value={form.geschlecht}
                    onChange={(e) => setForm({ ...form, geschlecht: e.target.value })}
                    options={[
                        { value: "MAENNLICH", label: "Männlich" },
                        { value: "WEIBLICH", label: "Weiblich" },
                        { value: "DIVERS", label: "Divers" },
                    ]}
                />
                <Input id="vnr" label="Versicherungsnummer" value={form.versicherungsnummer} onChange={(e) => setForm({ ...form, versicherungsnummer: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                    <Input id="telefon" label="Telefon" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
                    <Input id="email" type="email" label="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <Input id="adresse" label="Adresse" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
            </Dialog>
        </div>
    );
}
