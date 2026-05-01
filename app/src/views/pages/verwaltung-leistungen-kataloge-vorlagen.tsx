import { ROUTE_VISIBILITY, navVisibilitySatisfied, type NavVisibility } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { VerwaltungTocPage, type VerwaltungTocTextRow } from "../components/verwaltung-toc-page";

const LINKS_ALL: (VerwaltungTocTextRow & { visibility: NavVisibility })[] = [
    {
        title: "Leistungsvorlagen",
        desc: "Katalog und GOZ-orientierte Leistungen, Honorarlogik und Textbausteine.",
        href: "/leistungen",
        visibility: ROUTE_VISIBILITY.leistungen,
    },
    {
        title: "Behandlungskatalog",
        desc: "Kategorien und Leistungen für die Patientenakte (Auswahl bei Behandlungen).",
        href: "/verwaltung/behandlungs-katalog",
        visibility: ROUTE_VISIBILITY["verwaltung/behandlungs-katalog"],
    },
    {
        title: "Vorlagen Rezepte / Atteste",
        desc: "Vordefinierte Rezepte, Attest-Texte und Formulare.",
        href: "/verwaltung/vorlagen",
        visibility: ROUTE_VISIBILITY["verwaltung/vorlagen"],
    },
];

/** Leistungen, Kataloge, Vorlagen — Tabelle in Karte. */
export function VerwaltungLeistungenKatalogeVorlagenPage() {
    const rolle = useAuthStore((s) => s.session?.rolle);
    const rows = LINKS_ALL.filter((l) => navVisibilitySatisfied(l.visibility, rolle)).map((l) => ({
        title: l.title,
        desc: l.desc,
        href: l.href,
    }));
    return (
        <VerwaltungTocPage
            variant="subhub"
            title="Leistungen, Kataloge & Vorlagen"
            subtitle="Leistungstexte, Kataloge für die Akte sowie Vorlagen für Rezepte und Atteste."
            rows={rows}
        />
    );
}
