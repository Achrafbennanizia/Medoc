import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { buildComplianceReportBundle } from "@/lib/report-export";
import { ReportExportToolbar } from "../components/report-export-toolbar";
import {
    enforceLogRetention,
    generateDsfa,
    generateVvt,
    type DSFA,
    type LogRetentionReport,
    type ProcessingActivity,
    type RiskScenario,
    type VVT,
} from "@/systems/practice-host/controllers/compliance.controller";
import { Button } from "../components/ui/button";
import { useToastStore } from "../components/ui/toast-store";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { DismissibleNotice } from "../components/ui/dismissible-notice";

type ReportKind = "vvt" | "dsfa" | "retention";

export type CompliancePageProps = {
    embedded?: boolean;
};

function Bullets({ items }: { items: string[] }) {
    if (!items?.length) return <p style={{ color: "var(--fg-3)", margin: 0 }}>—</p>;
    return (
        <ul style={{ margin: "8px 0 0", paddingInlineStart: 20, color: "var(--fg-2)", lineHeight: 1.5 }}>
            {items.map((x, i) => (
                <li key={i}>{x}</li>
            ))}
        </ul>
    );
}

function ActivitySection({ a, index }: { a: ProcessingActivity; index: number }) {
    const t = useT();
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
                    <dt className="dl-term">{t("page.compliance.activity.purpose")}</dt>
                    <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{a.purpose}</dd>
                </div>
                <div>
                    <dt className="dl-term">{t("page.compliance.activity.legal_basis")}</dt>
                    <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{a.legal_basis}</dd>
                </div>
                <div>
                    <dt className="dl-term">{t("page.compliance.activity.data_categories")}</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.data_categories} /></dd>
                </div>
                <div>
                    <dt className="dl-term">{t("page.compliance.activity.subjects")}</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.data_subjects} /></dd>
                </div>
                <div>
                    <dt className="dl-term">{t("page.compliance.activity.recipients")}</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.recipients} /></dd>
                </div>
                <div>
                    <dt className="dl-term">{t("page.compliance.activity.retention")}</dt>
                    <dd style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{a.retention}</dd>
                </div>
                <div>
                    <dt className="dl-term">{t("page.compliance.activity.tech_measures")}</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.technical_measures} /></dd>
                </div>
                <div>
                    <dt className="dl-term">{t("page.compliance.activity.org_measures")}</dt>
                    <dd style={{ margin: "4px 0 0" }}><Bullets items={a.organisational_measures} /></dd>
                </div>
            </dl>
        </section>
    );
}

function VvtStructured({ data }: { data: VVT }) {
    const t = useT();
    const tp = useTParams();
    return (
        <div className="compliance-report-print">
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>{t("page.compliance.vvt.title")}</h2>
            <p style={{ margin: "0 0 16px", color: "var(--fg-3)", fontSize: 13 }}>
                {tp("page.compliance.vvt.subtitle", { date: formatDateTime(data.generated_at) })}
            </p>
            <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 14 }}>
                <div><strong>{t("page.compliance.vvt.controller")}</strong> {data.controller}</div>
                <div><strong>{t("page.compliance.vvt.system")}</strong> {data.system}</div>
                <div><strong>{t("page.compliance.vvt.version")}</strong> {data.system_version}</div>
            </dl>
            {data.activities.map((a, i) => (
                <ActivitySection key={`${a.name}-${i}`} a={a} index={i} />
            ))}
        </div>
    );
}

function ScenarioBlock({ s, index }: { s: RiskScenario; index: number }) {
    const t = useT();
    const tp = useTParams();
    return (
        <section style={{ marginTop: index === 0 ? 12 : 18, paddingTop: 14, borderTop: index === 0 ? undefined : "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 15 }}>
                {tp("page.compliance.scenario.title", { index: index + 1, threat: s.threat })}
            </h4>
            <dl style={{ margin: 0, display: "grid", gap: 8, fontSize: 14 }}>
                <div><strong>{t("page.compliance.scenario.likelihood")}</strong> {String(s.likelihood)}</div>
                <div><strong>{t("page.compliance.scenario.impact")}</strong> {String(s.impact)}</div>
                <div><strong>{t("page.compliance.scenario.residual")}</strong> {String(s.residual_risk)}</div>
                <div>
                    <strong>{t("page.compliance.scenario.measures")}</strong>
                    <Bullets items={s.mitigations} />
                </div>
            </dl>
        </section>
    );
}

function DsfaStructured({ data }: { data: DSFA }) {
    const t = useT();
    const tp = useTParams();
    return (
        <div className="compliance-report-print">
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>{t("page.compliance.dsfa.title")}</h2>
            <p style={{ margin: "0 0 16px", color: "var(--fg-3)", fontSize: 13 }}>
                {tp("page.compliance.dsfa.subtitle", { date: formatDateTime(data.generated_at) })}
            </p>
            <dl style={{ margin: "0 0 16px", display: "grid", gap: 6, fontSize: 14 }}>
                <div><strong>{t("page.compliance.vvt.system")}</strong> {data.system}</div>
                <div><strong>{t("page.compliance.vvt.version")}</strong> {data.system_version}</div>
            </dl>
            <section style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{t("page.compliance.dsfa.processing")}</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55, color: "var(--fg-2)" }}>{data.processing_overview}</p>
            </section>
            <section style={{ marginBottom: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{t("page.compliance.dsfa.necessity")}</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55, color: "var(--fg-2)" }}>{data.necessity_proportionality}</p>
            </section>
            <section>
                <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{t("page.compliance.dsfa.risk_scenarios")}</h3>
                {data.scenarios.map((s, i) => (
                    <ScenarioBlock key={`${s.threat}-${i}`} s={s} index={i} />
                ))}
            </section>
        </div>
    );
}

function RetentionStructured({ data }: { data: LogRetentionReport }) {
    const t = useT();
    return (
        <div className="compliance-report-print">
            <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>{t("page.compliance.retention.title")}</h2>
            <p style={{ margin: "0 0 16px", color: "var(--fg-3)", fontSize: 13 }}>{t("page.compliance.retention.report")}</p>
            <dl style={{ margin: "0 0 16px", display: "grid", gap: 8, fontSize: 14 }}>
                <div><strong>{t("page.compliance.retention.scanned")}</strong> {data.scanned}</div>
                <div><strong>{t("page.compliance.retention.kept")}</strong> {data.kept}</div>
                <div><strong>{t("page.compliance.retention.deleted")}</strong> {data.deleted.length}</div>
            </dl>
            {data.deleted.length > 0 ? (
                <section style={{ marginBottom: 14 }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{t("page.compliance.retention.deleted_ids")}</h3>
                    <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
                        {data.deleted.map((id, i) => (
                            <li key={i}>{id}</li>
                        ))}
                    </ul>
                </section>
            ) : null}
            {data.errors.length > 0 ? (
                <section>
                    <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "var(--red)" }}>{t("page.compliance.retention.errors")}</h3>
                    <ul style={{ margin: 0, paddingInlineStart: 20, color: "var(--red)", fontSize: 13 }}>
                        {data.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </section>
            ) : (
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14 }}>{t("page.compliance.retention.no_errors")}</p>
            )}
        </div>
    );
}

export function CompliancePage({ embedded = false }: CompliancePageProps = {}) {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [report, setReport] = useState<{ kind: ReportKind; data: unknown } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function run(kind: ReportKind) {
        setLoading(true);
        setError(null);
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

    const buildExportBundle = useCallback(() => {
        if (!report) return null;
        return buildComplianceReportBundle(
            report.kind,
            report.data as VVT | DSFA | LogRetentionReport,
        );
    }, [report]);

    async function copyStructuredJson() {
        if (!report) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(report.data, null, 2));
            toast(t("common.copy_json_ok"), "success");
        } catch (e) {
            toast(tp("common.copy_failed", { message: errorMessage(e) }), "error");
        }
    }

    function printReport() {
        window.print();
    }

    return (
        <div className={`${embedded ? "" : "praxis-workspace-page "}animate-fade-in`}>
            <style>{`
                @media print {
                    .compliance-no-print { display: none !important; }
                    body { background: #fff !important; }
                }
            `}</style>

            <WorkspacePageHeader
                className="compliance-no-print"
                titleLevel="h1"
                title={t("nav.compliance") || "Compliance"}
                subtitle={t("page.compliance.subtitle")}
                actions={
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        {!embedded ? (
                            <>
                                <Button type="button" variant="secondary" onClick={() => navigate("/feedback")}>
                                    {t("compliance.cta_feedback")}
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => navigate("/hilfe")}>
                                    {t("compliance.cta_hilfe")}
                                </Button>
                            </>
                        ) : null}
                        <Button type="button" onClick={() => run("vvt")} disabled={loading}>
                            {t("page.compliance.btn.vvt")}
                        </Button>
                        <Button type="button" onClick={() => run("dsfa")} disabled={loading}>
                            {t("page.compliance.btn.dsfa")}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => run("retention")} disabled={loading}>
                            {t("page.compliance.btn.retention")}
                        </Button>
                        {report ? (
                            <>
                                <Button type="button" variant="ghost" onClick={() => void copyStructuredJson()}>
                                    {t("page.compliance.copy_json")}
                                </Button>
                                <ReportExportToolbar
                                    dialogTitle={t("page.compliance.export_title")}
                                    buildBundle={buildExportBundle}
                                    defaultFormat="pdf"
                                    showImport
                                />
                                <Button type="button" variant="secondary" onClick={printReport}>
                                    {t("page.compliance.btn.print")}
                                </Button>
                            </>
                        ) : null}
                    </div>
                }
            />

            {error ? (
                <DismissibleNotice variant="error" role="alert" className="compliance-no-print" title={t("common.error")}>
                    {error}
                </DismissibleNotice>
            ) : null}

            {report && (
                <div className="card card-pad compliance-report-print">
                    {report.kind === "vvt" ? (
                        <VvtStructured data={report.data as VVT} />
                    ) : report.kind === "dsfa" ? (
                        <DsfaStructured data={report.data as DSFA} />
                    ) : (
                        <RetentionStructured data={report.data as LogRetentionReport} />
                    )}
                </div>
            )}
        </div>
    );
}
