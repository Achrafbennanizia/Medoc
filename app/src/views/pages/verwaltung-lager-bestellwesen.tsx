import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

const LINKS: VerwaltungTocLink[] = [
    {
        title: "Produktauswahl",
        desc: "Material, Artikel und Lager — Bestand und Auswahl für Behandlungen.",
        href: "/produkte",
        requires: "produkte",
    },
    {
        title: "Bestell-Stammdaten",
        desc: "Lieferanten, Kontakte und Kombinationen für „Neue Bestellung“.",
        href: "/verwaltung/bestellstamm",
        requires: "verwaltung/bestellstamm",
    },
    {
        title: "Verträge",
        desc: "Miete, Service, Versicherung — laufende Kosten und Daueraufträge (Ausgabenseite).",
        href: "/verwaltung/vertraege",
        requires: "verwaltung/vertraege",
    },
];

/** Lager, Produkte, Bestellstamm und Verträge — Tabelle in Karte (Produkte-Muster). */
export function VerwaltungLagerBestellwesenPage() {
    return (
        <VerwaltungTocPage
            title="Lager, Produkte & Bestellwesen"
            subtitle="Produktkatalog, Lager, Bestellstammdaten und Verträge mit Ausgabenwirkung."
            links={LINKS}
        />
    );
}
