import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../../lib/i18n";
import { errorMessage, formatDateTime } from "../../lib/utils";
import { openExportPreview } from "../../models/store/export-preview-store";
import {
    enforceLogRetention,
    generateDsfa,
    generateVvt,
    type DSFA,
    type LogRetentionReport,
    type ProcessingActivity,
    type RiskScenario,
    type VVT,
} from "../../controllers/compliance.controller";
import { Button } from "../components/ui/button";

type ReportKind = "vvt" | "dsfa" | "retention";

export type CompliancePageProps = {
    embedded?: boolean;
};

function Bullets({ items }: { items: string[] }) {
    if (!items?.length) return <p style={{ color: "var(--fg-3)", margin: 0 }}>—</p>;
    return (
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--fg-2)", lineHeight: 1.5 }}>
            {items.map((x, i) => (
                <li key={i}>{x}</li>
            ))}
        </ul>
    );
}

function ActivitySection({ a, index }: { a: ProcessingActivity; index: number }) {
    return (
        <section
            style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: index === 0 ? undefined : "1px solid var(--line)",
            }}
        >
            <h3 style={{ margin: "0 0 10px", fontSize: 17 }}>{a.name}</h3>
            <dl style={{ margin: 0, display: "grid", gap: 10 }}>
                <div>
                    <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-3)", textTransform: "uppercase" }}>Zweck</dt>
                    <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{a.purpose}</dd>
                </div>
                <div>
                    <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-3)", textTransform: "uppercase" }}>Rechtsgrundlage</dt>
                    <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{a.legal_basis}</dd>
                </div>
                <div>
                    <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-3)", textTransform: "uppercase" }}>Kategorien personenbezogener Daten</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.data_categories} /></dd>
                </div>
                <div>
                    <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-3)", textTransform: "uppercase" }}>Betroffene Personen</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.data_subjects} /></dd>
                </div>
                <div>
                    <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-3)", textTransform: "uppercase" }}>Empfänger</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.recipients} /></dd>
                </div>
                <div>
                    <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-3)", textTransform: "uppercase" }}>Aufbewahrung</dt>
                    <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{a.retention}</dd>
                </div>
                <div>
                    <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-3)", textTransform: "uppercase" }}>Technische Maßnahmen</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.technical_measures} /></dd>
                </div>
                <div>
                    <dt style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fg-3)", textTransform: "uppercase" }}>Organisatorische Maßnahmen</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.organisational_measures} /></dd>
                </div>
            </dl>
        </section>
    );
}

function VvtStructured({ data }: { data: VVT }) {
    return (
        <div className="compliance-report-print">
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Verzeichnis der Verarbeitungstätigkeiten</h2>
            <p style={{ margin: "0 0 16px", color: "var(--fg-3)", fontSize: 13 }}>Nach Art. 30 DSGVO · Erstellt {formatDateTime(data.generated_at)}</p>
            <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 14 }}>
                <div><strong>Verantwortlicher:</strong> {data.controller}</div>
                <div><strong>System:</strong> {data.system}</div>
                <div><strong>Version:</strong> {data.system_version}</div>
            </dl>
            {data.activities.map((a, i) => (
                <ActivitySection key={`${a.name}-${i}`} a={a} index={i} />
            ))}
        </div>
    );
}

function ScenarioBlock({ s, index }: { s: RiskScenario; index: number }) {
    return (
        <section style={{ marginTop: index === 0 ? 12 : 18, paddingTop: 14, borderTop: index === 0 ? undefined : "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 15 }}>Szenario {index + 1}: {s.threat}</h4>
            <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 14 }}>
                <div><strong>Eintrittswahrscheinlichkeit:</strong> {String(s.likelihood)}</div>
                <div><strong>Auswirkung:</strong> {String(s.impact)}</div>
                <div><strong>Restrisiko:</strong> {String(s.residual_risk)}</div>
                <div>
                    <strong>Maßnahmen</strong>
                    <Bullets items={s.mitigations} />
                </div>
            </dl>
        </section>
    );
}

function DsfaStructured({ data }: { data: DSFA }) {
    return (
        <div className="compliance-report-print">
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Datenschutz-Folgenabschätzung</h2>
            <p style={{ margin: "0 0 16px", color: "var(--fg-3)", fontSize: 13 }}>Nach Art. 35 DSGVO · Erstellt {formatDateTime(data.generated_at)}</p>
            <dl style={{ margin: "0 0 16px", display: "grid", gap: 6, fontSize: 14 }}>
                <div><strong>System:</strong> {data.system}</div>
                <div><strong>Version:</strong> {data.system_version}</div>
            </dl>
            <section style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Beschreibung der Verarbeitung</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55, color: "var(--fg-2)" }}>{data.processing_overview}</p>
            </section>
            <section style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Notwendigkeit und Verhältnismäßigkeit</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55, color: "var(--fg-2)" }}>{data.necessity_proportionality}</p>
            </section>
            <section>
                <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Risikoszenarien</h3>
                {data.scenarios.map((s, i) => (
                    <ScenarioBlock key={`${s.threat}-${i}`} s={s} index={i} />
                ))}
            </section>
        </div>
    );
}

function RetentionStructured({ data }: { data: LogRetentionReport }) {
    return (
        <div className="compliance-report-print">
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Log-Retention</h2>
            <p style={{ margin: "0 0 16px", color: "var(--fg-3)", fontSize: 13 }}>Ausführungsbericht</p>
            <dl style={{ margin: "0 0 16px", display: "grid", gap: 8, fontSize: 14 }}>
                <div><strong>Geprüfte Einträge:</strong> {data.scanned}</div>
                <div><strong>Beibehalten:</strong> {data.kept}</div>
                <div><strong>Gelöscht:</strong> {data.deleted.length}</div>
            </dl>
            {data.deleted.length > 0 ? (
                <section style={{ marginBottom: 14 }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Gelöschte Protokoll-IDs / Referenzen</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
                        {data.deleted.map((id, i) => (
                            <li key={i}>{id}</li>
                        ))}
                    </ul>
                </section>
            ) : null}
            {data.errors.length > 0 ? (
                <section>
                    <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "var(--red)" }}>Fehler</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, color: "var(--red)", fontSize: 13 }}>
                        {data.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </section>
            ) : (
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14 }}>Keine Fehler gemeldet.</p>
            )}
        </div>
    );
}

export function CompliancePage({ embedded = false }: CompliancePageProps = {}) {
    const t = useT();
    const navigate = useNavigate();
    const [report, setReport] = useState<{ kind: ReportKind; data: unknown } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRawJson, setShowRawJson] = useState(false);

    async function run(kind: ReportKind) {
        setLoading(true);
        setError(null);
        setShowRawJson(false);
        try {
            const data =
                kind === "vvt" ? await generateVvt()
                    : kind === "dsfa" ? await generateDsfa()
                        : await enforceLogRetention();
            setReport({ kind, data });
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }

    function download() {
        if (!report) return;
        const text = JSON.stringify(report.data, null, 2);
        openExportPreview({
            format: "json",
            title: "Compliance-Bericht exportieren",
            hint: `${report.kind.toUpperCase()} · JSON drucken oder als Datei sichern.`,
            suggestedFilename: `medoc-${report.kind}-${new Date().toISOString().slice(0, 10)}.json`,
            textBody: text,
        });
    }

    function printReport() {
        window.print();
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <style>{`
                @media print {
                    .compliance-no-print { display: none !important; }
                    body { background: #fff !important; }
                }
            `}</style>

            <header>
                <h1 className="page-title">{t("nav.compliance") || "Compliance"}</h1>
                <p style={{ color: "var(--fg-3)", fontSize: 14 }}>
                    DSGVO Art. 30 (VVT), Art. 35 (DSFA), Log-Retention
                </p>
            </header>

            <div className="compliance-no-print row" style={{ gap: 8, flexWrap: "wrap" }}>
                {!embedded ? (
                    <>
                        <Button type="button" variant="secondary" onClick={() => navigate("/feedback")}>
                            {t("compliance.cta_feedback")}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => navigate("/einstellungen?tab=hilfe")}>
                            {t("compliance.cta_hilfe")}
                        </Button>
                    </>
                ) : null}
                <Button type="button" onClick={() => run("vvt")} disabled={loading}>
                    VVT generieren
                </Button>
                <Button type="button" onClick={() => run("dsfa")} disabled={loading}>
                    DSFA generieren
                </Button>
                <Button type="button" variant="secondary" onClick={() => run("retention")} disabled={loading}>
                    Log-Retention durchsetzen
                </Button>
                {report ? (
                    <>
                        <Button type="button" variant="ghost" onClick={download}>
                            JSON herunterladen
                        </Button>
                        <Button type="button" variant="secondary" onClick={printReport}>
                            Bericht drucken
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setShowRawJson((x) => !x)}>
                            {showRawJson ? "Rohdaten ausblenden" : "Rohdaten (JSON)"}
                        </Button>
                    </>
                ) : null}
            </div>

            {error && (
                <div role="alert" className="card card-pad compliance-no-print" style={{ color: "var(--red)" }}>
                    {error}
                </div>
            )}

            {report && (
                <div className="card card-pad compliance-report-print">
                    {report.kind === "vvt" ? (
                        <VvtStructured data={report.data as VVT} />
                    ) : report.kind === "dsfa" ? (
                        <DsfaStructured data={report.data as DSFA} />
                    ) : (
                        <RetentionStructured data={report.data as LogRetentionReport} />
                    )}
                    {showRawJson ? (
                        <details className="compliance-no-print" style={{ marginTop: 20 }}>
                            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Technische Rohdaten (JSON)</summary>
                            <pre style={{ margin: "12px 0 0", overflow: "auto", maxHeight: "40vh", fontSize: 11, color: "var(--fg-3)" }}>
                                {JSON.stringify(report.data, null, 2)}
                            </pre>
                        </details>
                    ) : null}
                </div>
            )}
        </div>
    );
}
