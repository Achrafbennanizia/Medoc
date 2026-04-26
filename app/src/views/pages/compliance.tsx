import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../../lib/i18n";
import { errorMessage } from "../../lib/utils";
import { enforceLogRetention, generateDsfa, generateVvt } from "../../controllers/compliance.controller";
import { Button } from "../components/ui/button";

type ReportKind = "vvt" | "dsfa" | "retention";

export function CompliancePage() {
    const t = useT();
    const navigate = useNavigate();
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

    function download() {
        if (!report) return;
        const blob = new Blob([JSON.stringify(report.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `medoc-${report.kind}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <header>
                <h1 className="page-title">{t("nav.compliance") || "Compliance"}</h1>
                <p style={{ color: "var(--fg-3)", fontSize: 14 }}>
                    DSGVO Art. 30 (VVT), Art. 35 (DSFA), Log-Retention
                </p>
            </header>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button type="button" variant="secondary" onClick={() => navigate("/feedback")}>
                    {t("compliance.cta_feedback")}
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate("/hilfe")}>
                    {t("compliance.cta_hilfe")}
                </Button>
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
                    <Button type="button" variant="ghost" onClick={download}>
                        Herunterladen
                    </Button>
                ) : null}
            </div>

            {error && (
                <div role="alert" className="card card-pad" style={{ color: "var(--red)" }}>
                    {error}
                </div>
            )}

            {report && (
                <div className="card card-pad">
                    <pre aria-label={`Bericht ${report.kind}`} style={{ margin: 0, overflow: "auto", maxHeight: "60vh", fontSize: 12, color: "var(--fg-3)" }}>{JSON.stringify(report.data, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}
