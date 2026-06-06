import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed, parseRole } from "@/lib/rbac";
import { useT } from "@/lib/i18n";
import { AboutAppDialog } from "../components/app-help-dialogs";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";

export type HilfePageProps = {
    /** In Einstellungen eingebettet: keine Sprünge zu anderen Routen */
    embedded?: boolean;
};

export function HilfePage({ embedded = false }: HilfePageProps = {}) {
    const t = useT();
    const navigate = useNavigate();
    const [aboutOpen, setAboutOpen] = useState(false);
    const rolle = useAuthStore((s) => s.session?.rolle);
    const role = parseRole(rolle);
    const canMigration = role != null && allowed("ops.migration", role);

    const rows = useMemo(
        () => [
            { keys: t("page.hilfe.kbd.cmdk_keys"), action: t("page.hilfe.kbd.cmdk") },
            { keys: t("page.hilfe.kbd.question_keys"), action: t("page.hilfe.kbd.question") },
            { keys: t("page.hilfe.kbd.alt_keys"), action: t("page.hilfe.kbd.alt") },
            { keys: "Esc", action: t("page.hilfe.kbd.esc") },
            { keys: t("page.hilfe.kbd.tab_keys"), action: t("page.hilfe.kbd.tab") },
            { keys: t("page.hilfe.kbd.cal_keys"), action: t("termin.keyboard.hint") },
        ],
        [t],
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <header>
                <h1 className="page-title">{t("page.hilfe.title")}</h1>
                <p style={{ color: "var(--fg-3)", fontSize: 14, maxWidth: 720, lineHeight: 1.55 }}>{t("page.hilfe.intro")}</p>
            </header>

            <Card>
                <CardHeader title={t("page.hilfe.section_shortcuts")} />
                <div className="card-pad">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th style={{ width: "36%" }}>{t("page.hilfe.col_keys")}</th>
                                <th>{t("page.hilfe.col_action")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, idx) => (
                                <tr key={`${idx}-${r.keys}`}>
                                    <td>
                                        <kbd style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "rgba(0,0,0,0.06)" }}>{r.keys}</kbd>
                                    </td>
                                    <td style={{ fontSize: 13.5 }}>{r.action}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {!embedded ? (
                <Card>
                    <CardHeader title={t("page.hilfe.section_links")} />
                    <div className="card-pad row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <Button type="button" variant="secondary" onClick={() => navigate("/feedback")}>
                            {t("page.hilfe.link_feedback")}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => navigate("/compliance")}>
                            {t("page.hilfe.link_compliance")}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => navigate("/termine")}>
                            {t("page.hilfe.link_termine")}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setAboutOpen(true)}>
                            {t("page.hilfe.about_app")}
                        </Button>
                        {canMigration ? (
                            <Button type="button" variant="secondary" onClick={() => navigate("/migration")}>
                                {t("page.hilfe.link_migration")}
                            </Button>
                        ) : null}
                    </div>
                </Card>
            ) : (
                <Card>
                    <CardHeader title={t("page.hilfe.section_links")} />
                    <div className="card-pad col" style={{ gap: 14 }}>
                        <p className="card-sub" style={{ margin: 0 }}>
                            {t("page.hilfe.embedded_hint")}
                        </p>
                        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                            <Button type="button" variant="secondary" onClick={() => setAboutOpen(true)}>
                                {t("page.hilfe.embedded_about")}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
            <AboutAppDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
        </div>
    );
}
