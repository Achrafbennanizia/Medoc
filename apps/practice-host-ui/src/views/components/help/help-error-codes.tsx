import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { ERROR_CATALOG, errorDomainLabelKey, errorKindActionKey, errorKindCauseKey } from "@/lib/errors";
import { Select } from "@/views/components/ui/input";
import { matchesQuery, type HelpSectionProps } from "./help-search";

/** Strip `{param}` placeholders so manual rows read naturally. */
function genericMessage(text: string): string {
    return text.replace(/\{\w+\}/g, "…");
}

/** Error manual rendered from the catalog: code, message, why, what to do — in the active language. */
export function HelpErrorCodes({ query }: HelpSectionProps) {
    const t = useT();
    const [domain, setDomain] = useState("");
    const domains = useMemo(() => [...new Set(ERROR_CATALOG.map((e) => e.domain))].sort(), []);
    const rows = ERROR_CATALOG.filter(
        (e) =>
            (!domain || e.domain === domain) &&
            matchesQuery(query, e.code, e.key, t(e.key), t(errorDomainLabelKey(e.domain)), t(errorKindCauseKey(e.kind))),
    );
    const exact = query.trim().toUpperCase();

    return (
        <div className="help-stack">
            <div className="help-toolbar">
                <p className="help-intro">{t("help.errors.intro")}</p>
                <Select
                    aria-label={t("help.errors.filter_aria")}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    options={[
                        { value: "", label: t("help.errors.filter_all") },
                        ...domains.map((d) => ({ value: d, label: t(errorDomainLabelKey(d)) })),
                    ]}
                />
            </div>
            <p className="help-count" aria-live="polite">
                {t("help.result_count").replace("{count}", String(rows.length))}
            </p>
            {rows.length === 0 ? <p className="help-empty">{t("help.no_results").replace("{q}", query)}</p> : null}
            <ul className="help-error-list">
                {rows.map((e) => (
                    <li
                        key={e.code}
                        className={`help-error help-error--${e.severity}${e.code === exact ? " help-error--match" : ""}`}
                        id={`err-${e.code}`}
                    >
                        <header className="help-error__head">
                            <code className="help-error__code">{e.code}</code>
                            <span className="help-error__domain">{t(errorDomainLabelKey(e.domain))}</span>
                            <span className={`pill ${e.severity === "warning" ? "yellow" : e.severity === "critical" ? "red" : "orange"}`}>
                                {t(`errors.severity.${e.severity}`)}
                            </span>
                            {e.retryable ? <span className="pill grey">{t("errors.retryable")}</span> : null}
                        </header>
                        <p className="help-error__message">{genericMessage(t(e.key))}</p>
                        <dl className="help-error__details">
                            <dt>{t("help.errors.cause")}</dt>
                            <dd>{t(errorKindCauseKey(e.kind))}</dd>
                            <dt>{t("help.errors.action")}</dt>
                            <dd>{t(errorKindActionKey(e.kind))}</dd>
                        </dl>
                    </li>
                ))}
            </ul>
        </div>
    );
}
