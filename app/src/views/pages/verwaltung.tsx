import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon, NAV_ICONS } from "@/lib/icons";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed, parseRole } from "@/lib/rbac";

type VerwaltungCardDef = {
    id: string;
    label: string;
    desc: string;
    href: string;
    iconKey: string;
};

const VERWALTUNG_CARDS: VerwaltungCardDef[] = [
    {
        id: "team",
        label: "Team",
        desc: "Personalverwaltung und Arbeitsplan & Einsätze — Untermenü wie bei Finanzen & Berichte.",
        href: "/verwaltung/team",
        iconKey: "/personal",
    },
    {
        id: "finanzen",
        label: "Finanzen & Berichte",
        desc: "Rechnung, Tagesabschluss, Bilanzen und weitere Werkzeuge.",
        href: "/verwaltung/finanzen-berichte",
        iconKey: "/finanzen",
    },
    {
        id: "lager",
        label: "Lager, Produkte & Bestellwesen",
        desc: "Produkte, Lager, Bestellstamm, Verträge und laufende Ausgaben.",
        href: "/verwaltung/lager-und-bestellwesen",
        iconKey: "/produkte",
    },
    {
        id: "leistungen_kataloge",
        label: "Leistungen, Kataloge & Vorlagen",
        desc: "Leistungskatalog, Behandlungskatalog, Rezepte- und Attest-Vorlagen.",
        href: "/verwaltung/leistungen-kataloge-vorlagen",
        iconKey: "/leistungen",
    },
    {
        id: "praxis",
        label: "Praxis, Termine & Kalender",
        desc: "Urlaub, Sperrzeiten, Arbeitszeiten und Praxis-Präferenzen — Praxisplanung.",
        href: "/verwaltung/praxisplanung",
        iconKey: "/termine",
    },
];

const defaultHubIcon = NAV_ICONS["/verwaltung"]!;

/** Verwaltung: eine Liste in einer Karte (wie Produkte-Listenseite) — Klick auf Zeile öffnet den Bereich. */
export function VerwaltungPage() {
    const navigate = useNavigate();
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canGoDashboard = role != null && allowed("dashboard.read", role);

    return (
        <div className="verwaltung-menu-page animate-fade-in">
            {canGoDashboard ? (
                <div>
                    <button type="button" className="btn btn-subtle" onClick={() => navigate("/")}>
                        <ChevronLeftIcon />
                        {" "}
                        Übersicht
                    </button>
                </div>
            ) : null}
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Verwaltung</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Stammdaten und Werkzeuge — wählen Sie eine Zeile, um den Bereich zu öffnen.
                    </p>
                </div>
            </div>

            <div className="card verwaltung-toc-table-card">
                <table className="tbl" style={{ minWidth: 480 }}>
                    <thead>
                        <tr>
                            <th scope="col" style={{ width: 44 }} aria-hidden />
                            <th scope="col">Kategorie</th>
                            <th scope="col">Kurzinfo</th>
                            <th scope="col" style={{ width: 40 }} aria-hidden />
                        </tr>
                    </thead>
                    <tbody>
                        {VERWALTUNG_CARDS.map((c) => {
                            const Ic = NAV_ICONS[c.iconKey] ?? defaultHubIcon;
                            return (
                                <tr
                                    key={c.id}
                                    className="verwaltung-toc-row"
                                    onClick={() => navigate(c.href)}
                                    title="Öffnen"
                                >
                                    <td>
                                        <span
                                            className="verwaltung-toc-ic"
                                            aria-hidden
                                        >
                                            <Ic size={18} />
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{c.label}</span>
                                    </td>
                                    <td>
                                        <span className="page-sub" style={{ fontSize: 13, display: "block", lineHeight: 1.4 }}>
                                            {c.desc}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: "right", color: "var(--fg-4)" }}>›</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
