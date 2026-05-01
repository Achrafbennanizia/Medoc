import { VerwaltungTocPage, type VerwaltungTocTextRow } from "../components/verwaltung-toc-page";

const LINKS: VerwaltungTocTextRow[] = [
    {
        title: "Urlaub & Feiertage",
        desc: "Abwesenheiten, Praxisferien und Feiertage für das Team hinterlegen.",
        href: "/verwaltung/arbeitstage",
    },
    {
        title: "Sonder-Sperrzeiten",
        desc: "Ganze Tage, halbe Tage oder kurzfristige Schließungen für einzelne Daten hinterlegen.",
        href: "/verwaltung/sonder-sperrzeiten",
    },
    {
        title: "Arbeitszeiten",
        desc: "Sprechzeiten pro Wochentag, Pausenfenster und Standard-Slotdauer definieren.",
        href: "/verwaltung/arbeitszeiten",
    },
    {
        title: "Praxis-Präferenzen",
        desc: "Terminregeln, Pufferzeiten und Standardverhalten für die Terminübersicht festlegen.",
        href: "/verwaltung/praxis-praeferenzen",
    },
];

export function PraxisplanungPage() {
    return (
        <VerwaltungTocPage
            variant="subhub"
            title="Praxisplanung"
            subtitle="Globale Praxis-Vorgaben — die Terminübersicht nutzt diese Einstellungen statt eines lokalen Pause-Blocks. Zeile wählen zum Öffnen."
            rows={LINKS}
        />
    );
}
