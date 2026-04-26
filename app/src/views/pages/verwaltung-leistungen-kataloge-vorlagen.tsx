import { useNavigate } from "react-router-dom";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

const LINKS: { title: string; desc: string; href: string }[] = [
    {
        title: "Leistungsvorlagen",
        desc: "Katalog und GOZ-orientierte Leistungen, Honorarlogik und Textbausteine.",
        href: "/leistungen",
    },
    {
        title: "Behandlungskatalog",
        desc: "Kategorien und Leistungen für die Patientenakte (Auswahl bei Behandlungen).",
        href: "/verwaltung/behandlungs-katalog",
    },
    {
        title: "Vorlagen Rezepte / Atteste",
        desc: "Vordefinierte Rezepte, Attest-Texte und Formulare.",
        href: "/verwaltung/vorlagen",
    },
];

/** Leistungen, Kataloge, Vorlagen — Tabelle in Karte. */
export function VerwaltungLeistungenKatalogeVorlagenPage() {
    const navigate = useNavigate();
    return (
        <div className="verwaltung-menu-page animate-fade-in">
            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Leistungen, Kataloge &amp; Vorlagen</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Leistungstexte, Kataloge für die Akte sowie Vorlagen für Rezepte und Atteste.
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
