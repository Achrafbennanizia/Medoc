import { ROUTE_VISIBILITY, navVisibilitySatisfied, type NavVisibility } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { VerwaltungTocPage, type VerwaltungTocTextRow } from "../components/verwaltung-toc-page";

const LINKS_ALL: (VerwaltungTocTextRow & { visibility: NavVisibility })[] = [
    {
        title: "Produktauswahl",
        desc: "Material, Artikel und Lager — Bestand und Auswahl für Behandlungen.",
        href: "/produkte",
        visibility: ROUTE_VISIBILITY.produkte,
    },
    {
        title: "Bestell-Stammdaten",
        desc: "Lieferanten, Kontakte und Kombinationen für „Neue Bestellung“.",
        href: "/verwaltung/bestellstamm",
        visibility: ROUTE_VISIBILITY["verwaltung/bestellstamm"],
    },
    {
        title: "Verträge",
        desc: "Miete, Service, Versicherung — laufende Kosten und Daueraufträge (Ausgabenseite).",
        href: "/verwaltung/vertraege",
        visibility: ROUTE_VISIBILITY["verwaltung/vertraege"],
    },
];

/** Lager, Produkte, Bestellstamm und Verträge — Tabelle in Karte (Produkte-Muster). */
export function VerwaltungLagerBestellwesenPage() {
    const rolle = useAuthStore((s) => s.session?.rolle);
    const rows = LINKS_ALL.filter((l) => navVisibilitySatisfied(l.visibility, rolle)).map((l) => ({
        title: l.title,
        desc: l.desc,
        href: l.href,
    }));
    return (
        <VerwaltungTocPage
            variant="subhub"
            title="Lager, Produkte & Bestellwesen"
            subtitle="Produktkatalog, Lager, Bestellstammdaten und Verträge mit Ausgabenwirkung."
            rows={rows}
        />
    );
}
