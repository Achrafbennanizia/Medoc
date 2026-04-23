import { useState } from "react";
import { useT } from "../../lib/i18n";
import { errorMessage } from "../../lib/utils";
import { enforceLogRetention, generateDsfa, generateVvt } from "../../controllers/compliance.controller";
import { Button } from "../components/ui/button";

type ReportKind = "vvt" | "dsfa" | "retention";

export function CompliancePage() {
    const t = useT();
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
        <div className="space-y-4">
            <header>
                <h1 className="text-headline text-on-surface">{t("nav.compliance") || "Compliance"}</h1>
                <p className="text-body text-on-surface-variant">
                    DSGVO Art. 30 (VVT), Art. 35 (DSFA), Log-Retention
                </p>
            </header>

            <div className="flex flex-wrap gap-2">
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
                <div role="alert" className="p-3 rounded-lg bg-error/10 text-error text-body-medium">
                    {error}
                </div>
            )}

            {report && (
                <pre
                    aria-label={`Bericht ${report.kind}`}
                    className="bg-surface-container p-4 rounded-lg text-caption text-on-surface-variant overflow-auto max-h-[60vh]"
                >
                    {JSON.stringify(report.data, null, 2)}
                </pre>
            )}
        </div>
    );
}
