import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

const LINKS: VerwaltungTocLink[] = [
    {
        title: "Tagesabschluss",
        desc: "Kassenabgleich, protokollierte Tagesabschlüsse und Tageszahlen — Liste + Detail.",
        href: "/verwaltung/finanzen-berichte/tagesabschluss",
        requires: "verwaltung/finanzen-berichte/tagesabschluss",
    },
    {
        title: "Rechnung (PDF)",
        desc: "Rechnungs-PDF erzeugen — gleiche Arbeitsfläche wie andere Verwaltungslisten.",
        href: "/verwaltung/finanzen-berichte/rechnung",
        requires: "verwaltung/finanzen-berichte/rechnung",
    },
    {
        title: "Bilanzen",
        desc: "Übersicht, Export und Assistent „Neuer Bilanz“.",
        href: "/bilanz",
        requires: "bilanz",
    },
];

/** Untermenü „Finanzen & Berichte“ — gleiche Listenseite wie Produkte/Verwaltung-TOC. */
export function VerwaltungFinanzenBerichtePage() {
    return (
        <VerwaltungTocPage
            title="Finanzen & Berichte"
            subtitle="Tagesabschluss, Rechnungs-PDF und Bilanzen — Zeile wählen zum Öffnen."
            links={LINKS}
        />
    );
}
