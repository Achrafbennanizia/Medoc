import { useNavigate } from "react-router-dom";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

const LINKS: { title: string; desc: string; href: string }[] = [
    {
        title: "Produktauswahl",
        desc: "Material, Artikel und Lager — Bestand und Auswahl für Behandlungen.",
        href: "/produkte",
    },
    {
        title: "Bestell-Stammdaten",
        desc: "Lieferanten, Kontakte und Kombinationen für „Neue Bestellung“.",
        href: "/verwaltung/bestellstamm",
    },
    {
        title: "Verträge",
        desc: "Miete, Service, Versicherung — laufende Kosten und Daueraufträge (Ausgabenseite).",
        href: "/verwaltung/vertraege",
    },
];

/** Lager, Produkte, Bestellstamm und Verträge — Tabelle in Karte (Produkte-Muster). */
export function VerwaltungLagerBestellwesenPage() {
    const navigate = useNavigate();
    return (
        <div className="verwaltung-menu-page animate-fade-in">
            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Lager, Produkte &amp; Bestellwesen</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Produktkatalog, Lager, Bestellstammdaten und Verträge mit Ausgabenwirkung.
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
