import { useState } from "react";
import { bcp47ForLocale, useLocale, useT } from "@/lib/i18n";
import { clearErrorJournal, recentErrors } from "@/lib/errors";
import { Button } from "@/views/components/ui/button";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Session error journal for support (codes + page + time; raw text only for coded/system errors). */
export function HelpRecentErrors() {
    const t = useT();
    const locale = useLocale((s) => s.locale);
    const toast = useToastStore((s) => s.add);
    const [, force] = useState(0);
    const rows = recentErrors();

    const copy = async () => {
        const text = rows
            .map((r) => `${new Date(r.at).toISOString()}\t${r.code}\t${r.route}\t${r.key}`)
            .join("\n");
        try {
            await navigator.clipboard.writeText(`MeDoc ${import.meta.env.VITE_APP_VERSION ?? ""}\n${text}`);
            toast(t("errors.copied"), "success");
        } catch {
            /* clipboard blocked */
        }
    };

    return (
        <div className="help-stack">
            <div className="help-toolbar">
                <p className="help-intro">{t("help.recent.intro")}</p>
                <div className="help-toolbar__actions">
                    <Button type="button" variant="secondary" disabled={rows.length === 0} onClick={() => void copy()}>
                        {t("help.recent.copy_all")}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={rows.length === 0}
                        onClick={() => {
                            clearErrorJournal();
                            force((n) => n + 1);
                        }}
                    >
                        {t("help.recent.clear")}
                    </Button>
                </div>
            </div>
            {rows.length === 0 ? (
                <p className="help-empty">{t("help.recent.empty")}</p>
            ) : (
                <div className="data-table-wrap">
                    <table className="tbl data-table">
                        <thead>
                            <tr>
                                <th scope="col">{t("help.recent.col_time")}</th>
                                <th scope="col">{t("help.errors.col_code")}</th>
                                <th scope="col">{t("help.errors.col_message")}</th>
                                <th scope="col">{t("help.recent.col_page")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={`${r.at}-${i}`}>
                                    <td className="data-table__num">
                                        {new Date(r.at).toLocaleTimeString(bcp47ForLocale(locale), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                    </td>
                                    <td>
                                        <code>{r.code}</code>
                                    </td>
                                    <td>{r.message}</td>
                                    <td className="data-table__muted">{r.route}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
