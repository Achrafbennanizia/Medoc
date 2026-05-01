import { ROUTE_VISIBILITY, navVisibilitySatisfied, type NavVisibility } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { VerwaltungTocPage, type VerwaltungTocTextRow } from "../components/verwaltung-toc-page";

const LINKS_ALL: (VerwaltungTocTextRow & { visibility: NavVisibility })[] = [
    {
        title: "Tagesabschluss",
        desc: "Kassenabgleich, protokollierte Tagesabschlüsse und Tageszahlen — Liste + Detail.",
        href: "/verwaltung/finanzen-berichte/tagesabschluss",
        visibility: ROUTE_VISIBILITY["verwaltung/finanzen-berichte/tagesabschluss"],
    },
    {
        title: "Rechnung (PDF)",
        desc: "Rechnungs-PDF erzeugen — gleiche Arbeitsfläche wie andere Verwaltungslisten.",
        href: "/verwaltung/finanzen-berichte/rechnung",
        visibility: ROUTE_VISIBILITY["verwaltung/finanzen-berichte/rechnung"],
    },
    {
        title: "Bilanzen",
        desc: "Übersicht, Export und Assistent „Neuer Bilanz“.",
        href: "/bilanz",
        visibility: ROUTE_VISIBILITY.bilanz,
    },
];

/** Untermenü „Finanzen & Berichte“ — gleiche Listenseite wie Produkte/Verwaltung-TOC. */
export function VerwaltungFinanzenBerichtePage() {
    const rolle = useAuthStore((s) => s.session?.rolle);
    const rows = LINKS_ALL.filter((l) => navVisibilitySatisfied(l.visibility, rolle)).map((l) => ({
        title: l.title,
        desc: l.desc,
        href: l.href,
    }));
    return (
        <VerwaltungTocPage
            variant="subhub"
            title="Finanzen & Berichte"
            subtitle="Tagesabschluss, Rechnungs-PDF und Bilanzen — Zeile wählen zum Öffnen."
            rows={rows}
        />
    );
}
