import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

const LINKS: VerwaltungTocLink[] = [
    {
        title: "Leistungsvorlagen",
        desc: "Katalog und GOZ-orientierte Leistungen, Honorarlogik und Textbausteine.",
        href: "/leistungen",
        requires: "leistungen",
    },
    {
        title: "Behandlungskatalog",
        desc: "Kategorien und Leistungen für die Patientenakte (Auswahl bei Behandlungen).",
        href: "/verwaltung/behandlungs-katalog",
        requires: "verwaltung/behandlungs-katalog",
    },
    {
        title: "Vorlagen Rezepte / Atteste",
        desc: "Vordefinierte Rezepte, Attest-Texte und Formulare.",
        href: "/verwaltung/vorlagen",
        requires: "verwaltung/vorlagen",
    },
];

/** Leistungen, Kataloge, Vorlagen — Tabelle in Karte. */
export function VerwaltungLeistungenKatalogeVorlagenPage() {
    return (
        <VerwaltungTocPage
            title="Leistungen, Kataloge & Vorlagen"
            subtitle="Leistungstexte, Kataloge für die Akte sowie Vorlagen für Rezepte und Atteste."
            links={LINKS}
        />
    );
}
