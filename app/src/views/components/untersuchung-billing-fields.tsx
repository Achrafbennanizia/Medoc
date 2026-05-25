import type { BehandlungsKatalogItem } from "@/models/types";
import { Input, Select } from "./ui/input";

export type UntersuchungBillingFormState = {
    kategorie: string;
    leistungsname: string;
    leistungKatalogId: string;
    gesamtkosten: string;
};

export const EMPTY_UNTERSUCHUNG_BILLING = (): UntersuchungBillingFormState => ({
    kategorie: "",
    leistungsname: "",
    leistungKatalogId: "",
    gesamtkosten: "",
});

type Props = {
    katalog: BehandlungsKatalogItem[];
    form: UntersuchungBillingFormState;
    setForm: (next: UntersuchungBillingFormState) => void;
    locked?: boolean;
};

export function UntersuchungBillingFields({ katalog, form, setForm, locked = false }: Props) {
    const kategorieOptions = [
        { value: "", label: "— Kategorie wählen —" },
        ...Array.from(new Set(katalog.map((k) => k.kategorie).filter(Boolean))).map((c) => ({
            value: c,
            label: c,
        })),
    ];
    const leistungOptions = [
        { value: "", label: "— Leistung aus Katalog —" },
        ...katalog
            .filter((k) => !form.kategorie.trim() || k.kategorie === form.kategorie)
            .map((k) => ({ value: k.id, label: `${k.name} (${k.kategorie})` })),
    ];

    return (
        <div
            className="col"
            style={{
                gap: 10,
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: "1px solid var(--line)",
            }}
        >
            <div style={{ fontSize: 13, fontWeight: 600 }}>Abrechnungsleistung (optional)</div>
            <div className="grid-2" style={{ gap: 10 }}>
                <Select
                    label="Kategorie"
                    value={form.kategorie}
                    options={kategorieOptions}
                    disabled={locked}
                    onChange={(e) => {
                        const v = e.target.value;
                        setForm({
                            ...form,
                            kategorie: v,
                            leistungsname: "",
                            leistungKatalogId: "",
                            gesamtkosten: "",
                        });
                    }}
                />
                <Select
                    label="Leistung aus Katalog"
                    value={form.leistungKatalogId || ""}
                    options={leistungOptions}
                    disabled={locked}
                    onChange={(e) => {
                        const idSel = e.target.value;
                        const item = katalog.find((k) => k.id === idSel);
                        setForm({
                            ...form,
                            leistungKatalogId: idSel,
                            leistungsname: item?.name ?? "",
                            kategorie: item?.kategorie ?? form.kategorie,
                            gesamtkosten:
                                item?.default_kosten != null && Number.isFinite(item.default_kosten)
                                    ? String(item.default_kosten)
                                    : form.gesamtkosten,
                        });
                    }}
                />
                <Input
                    label="Leistungsname (Text)"
                    value={form.leistungsname}
                    disabled={locked}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            leistungsname: e.target.value,
                            leistungKatalogId: "",
                        })
                    }
                    placeholder="Aus Katalog oder frei — für Abrechnung erforderlich"
                />
                <Input
                    label="Gesamtkosten (€)"
                    value={form.gesamtkosten}
                    disabled={locked}
                    onChange={(e) => setForm({ ...form, gesamtkosten: e.target.value })}
                />
            </div>
        </div>
    );
}
