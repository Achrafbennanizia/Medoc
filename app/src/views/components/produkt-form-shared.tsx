import { useId } from "react";
import type { ProduktForm } from "@/lib/produkt-form-model";
import { Input, Textarea } from "./ui/input";

export function ProduktFormFields({
    form,
    setForm,
    idPrefix,
    kategorieVorschlaege,
}: {
    form: ProduktForm;
    setForm: (f: ProduktForm | ((p: ProduktForm) => ProduktForm)) => void;
    idPrefix: string;
    kategorieVorschlaege: string[];
}) {
    const kategorieDatalistId = useId();
    return (
        <>
            <Input
                id={`${idPrefix}-name`}
                label="Name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <div>
                <Input
                    id={`${idPrefix}-kat`}
                    label="Kategorie"
                    value={form.kategorie}
                    list={kategorieDatalistId}
                    autoComplete="off"
                    onChange={(e) => setForm((p) => ({ ...p, kategorie: e.target.value }))}
                />
                <datalist id={kategorieDatalistId}>
                    {kategorieVorschlaege.map((k) => (
                        <option key={k} value={k} />
                    ))}
                </datalist>
            </div>
            <Input
                id={`${idPrefix}-preis`}
                type="number"
                min={0}
                step="0.01"
                label="Preis (€)"
                value={form.preis}
                onChange={(e) => setForm((p) => ({ ...p, preis: e.target.value }))}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                    id={`${idPrefix}-bestand`}
                    type="number"
                    label="Bestand"
                    value={form.bestand}
                    onChange={(e) => setForm((p) => ({ ...p, bestand: e.target.value }))}
                />
                <Input
                    id={`${idPrefix}-mindest`}
                    type="number"
                    label="Mindestbestand"
                    value={form.mindestbestand}
                    onChange={(e) => setForm((p) => ({ ...p, mindestbestand: e.target.value }))}
                />
            </div>
            <Textarea
                id={`${idPrefix}-beschr`}
                label="Beschreibung"
                rows={3}
                value={form.beschreibung}
                onChange={(e) => setForm((p) => ({ ...p, beschreibung: e.target.value }))}
            />
        </>
    );
}
