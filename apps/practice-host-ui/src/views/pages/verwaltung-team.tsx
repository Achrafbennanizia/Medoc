import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

const LINKS: VerwaltungTocLink[] = [
    {
        title: "Personalverwaltung",
        desc: "Mitarbeiter anlegen und bearbeiten, Rollen und Zugänge.",
        href: "/personal",
        requires: "personal",
    },
    {
        title: "Arbeitsplan & Einsätze",
        desc: "Arbeits- & Pausenregeln, Kalender (Tag, Woche, Monat) und Einsätze pro Person — inkl. Netto (Arbeit − Pause).",
        href: "/personal/arbeitsplan",
        requires: "personal/arbeitsplan",
    },
];

/** Untermenü „Team“ unter Verwaltung — gleiche Musterseite wie „Finanzen & Berichte“. */
export function VerwaltungTeamPage() {
    return (
        <VerwaltungTocPage
            title="Team"
            subtitle="Personalverwaltung und Arbeitsplan wählen — Zeile antippen zum Öffnen."
            links={LINKS}
        />
    );
}
