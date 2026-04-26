import { useNavigate } from "react-router-dom";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

const LINKS: { title: string; desc: string; href: string }[] = [
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
    const navigate = useNavigate();
    return (
        <div className="verwaltung-menu-page animate-fade-in">
            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Praxisplanung</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Globale Praxis-Vorgaben — die Terminübersicht nutzt diese Einstellungen statt eines lokalen
                        Pause-Blocks. Zeile wählen zum Öffnen.
                    </p>
                </div>
            </div>

            <div className="card verwaltung-toc-table-card">
                <table className="tbl" style={{ minWidth: 480 }}>
                    <thead>
                        <tr>
                            <th scope="col">Bereich</th>
                            <th scope="col">Beschreibung</th>
                            <th scope="col" style={{ width: 40 }} aria-hidden />
                        </tr>
                    </thead>
                    <tbody>
                        {LINKS.map((item) => (
                            <tr
                                key={item.title}
                                className="verwaltung-toc-row"
                                onClick={() => navigate(item.href)}
                                title="Öffnen"
                            >
                                <td>
                                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{item.title}</span>
                                </td>
                                <td>
                                    <span className="page-sub" style={{ fontSize: 13, display: "block", lineHeight: 1.4 }}>
                                        {item.desc}
                                    </span>
                                </td>
                                <td style={{ textAlign: "right", color: "var(--fg-4)" }}>›</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
