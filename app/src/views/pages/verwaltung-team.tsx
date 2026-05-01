import { VerwaltungTocPage, type VerwaltungTocTextRow } from "../components/verwaltung-toc-page";

const LINKS: VerwaltungTocTextRow[] = [
    {
        title: "Personalverwaltung",
        desc: "Mitarbeiter anlegen und bearbeiten, Rollen und Zugänge.",
        href: "/personal",
    },
    {
        title: "Arbeitsplan & Einsätze",
        desc: "Arbeits- & Pausenregeln, Kalender (Tag, Woche, Monat) und Einsätze pro Person — inkl. Netto (Arbeit − Pause).",
        href: "/personal/arbeitsplan",
    },
];

/** Untermenü „Team“ unter Verwaltung — gleiche Musterseite wie „Finanzen & Berichte“. */
export function VerwaltungTeamPage() {
    return (
        <VerwaltungTocPage
            variant="subhub"
            title="Team"
            subtitle="Personalverwaltung und Arbeitsplan wählen — Zeile antippen zum Öffnen."
            rows={LINKS}
        />
    );
}
