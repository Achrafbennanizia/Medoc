import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

const VERWALTUNG_LINKS: VerwaltungTocLink[] = [
    {
        title: "Team",
        desc: "Personalverwaltung und Arbeitsplan & Einsätze — Untermenü wie bei Finanzen & Berichte.",
        href: "/verwaltung/team",
        iconKey: "/personal",
        requires: "verwaltung/team",
    },
    {
        title: "Finanzen & Berichte",
        desc: "Rechnung, Tagesabschluss, Bilanzen und weitere Werkzeuge.",
        href: "/verwaltung/finanzen-berichte",
        iconKey: "/finanzen",
        requires: "verwaltung/finanzen-berichte",
    },
    {
        title: "Lager, Produkte & Bestellwesen",
        desc: "Produkte, Lager, Bestellstamm, Verträge und laufende Ausgaben.",
        href: "/verwaltung/lager-und-bestellwesen",
        iconKey: "/produkte",
        requires: "verwaltung/lager-und-bestellwesen",
    },
    {
        title: "Leistungen, Kataloge & Vorlagen",
        desc: "Leistungskatalog, Behandlungskatalog, Rezepte- und Attest-Vorlagen.",
        href: "/verwaltung/leistungen-kataloge-vorlagen",
        iconKey: "/leistungen",
        requires: "verwaltung/leistungen-kataloge-vorlagen",
    },
    {
        title: "Praxis, Termine & Kalender",
        desc: "Urlaub, Sperrzeiten, Arbeitszeiten und Praxis-Präferenzen — Praxisplanung.",
        href: "/verwaltung/praxisplanung",
        iconKey: "/termine",
        requires: "verwaltung/praxisplanung",
    },
];

export function VerwaltungPage() {
    return (
        <VerwaltungTocPage
            title="Verwaltung"
            subtitle="Stammdaten und Werkzeuge — wählen Sie eine Zeile, um den Bereich zu öffnen."
            links={VERWALTUNG_LINKS}
        />
    );
}
