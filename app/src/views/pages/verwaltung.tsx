import { ROUTE_VISIBILITY, navVisibilitySatisfied } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { VerwaltungTocPage, type VerwaltungTocIconRow } from "../components/verwaltung-toc-page";

type VerwaltungCardDef = VerwaltungTocIconRow & { routeKey: keyof typeof ROUTE_VISIBILITY };

const VERWALTUNG_CARDS: VerwaltungCardDef[] = [
    {
        id: "team",
        title: "Team",
        desc: "Personalverwaltung und Arbeitsplan & Einsätze — Untermenü wie bei Finanzen & Berichte.",
        href: "/verwaltung/team",
        iconKey: "/personal",
        routeKey: "verwaltung/team",
    },
    {
        id: "finanzen",
        title: "Finanzen & Berichte",
        desc: "Rechnung, Tagesabschluss, Bilanzen und weitere Werkzeuge.",
        href: "/verwaltung/finanzen-berichte",
        iconKey: "/finanzen",
        routeKey: "verwaltung/finanzen-berichte",
    },
    {
        id: "lager",
        title: "Lager, Produkte & Bestellwesen",
        desc: "Produkte, Lager, Bestellstamm, Verträge und laufende Ausgaben.",
        href: "/verwaltung/lager-und-bestellwesen",
        iconKey: "/produkte",
        routeKey: "verwaltung/lager-und-bestellwesen",
    },
    {
        id: "leistungen_kataloge",
        title: "Leistungen, Kataloge & Vorlagen",
        desc: "Leistungskatalog, Behandlungskatalog, Rezepte- und Attest-Vorlagen.",
        href: "/verwaltung/leistungen-kataloge-vorlagen",
        iconKey: "/leistungen",
        routeKey: "verwaltung/leistungen-kataloge-vorlagen",
    },
    {
        id: "praxis",
        title: "Praxis, Termine & Kalender",
        desc: "Urlaub, Sperrzeiten, Arbeitszeiten und Praxis-Präferenzen — Praxisplanung.",
        href: "/verwaltung/praxisplanung",
        iconKey: "/termine",
        routeKey: "verwaltung/praxisplanung",
    },
];

/** Verwaltung: eine Liste in einer Karte (wie Produkte-Listenseite) — Klick auf Zeile öffnet den Bereich. */
export function VerwaltungPage() {
    const rolle = useAuthStore((s) => s.session?.rolle);
    const rows = VERWALTUNG_CARDS.filter((c) => navVisibilitySatisfied(ROUTE_VISIBILITY[c.routeKey], rolle)).map((c) => ({
        id: c.id,
        title: c.title,
        desc: c.desc,
        href: c.href,
        iconKey: c.iconKey,
    }));

    return (
        <VerwaltungTocPage
            variant="root"
            title="Verwaltung"
            subtitle="Stammdaten und Werkzeuge — wählen Sie eine Zeile, um den Bereich zu öffnen."
            rows={rows}
        />
    );
}
