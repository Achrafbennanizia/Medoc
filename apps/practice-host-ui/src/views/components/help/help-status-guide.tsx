import { useT } from "@/lib/i18n";
import { StatusBadge } from "@/views/components/ui/status-badge";
import {
    STATUS_ENTITY_IDS,
    STATUS_REGISTRY,
    statusDescriptionKey,
    statusFlagLabelKey,
    statusLabelKey,
} from "@/lib/status/status-registry";
import { matchesQuery, type HelpSectionProps } from "./help-search";

/** Status manual rendered straight from the registry — cannot drift from what the app shows. */
export function HelpStatusGuide({ query }: HelpSectionProps) {
    const t = useT();
    const entities = STATUS_ENTITY_IDS.map((id) => {
        const ent = STATUS_REGISTRY[id];
        const entityName = t(`status.entity.${id}`);
        const states = ent.states.filter((st) =>
            matchesQuery(query, entityName, st.wire, t(statusLabelKey(id, st.wire)), t(statusDescriptionKey(id, st.wire))),
        );
        return { id, ent, entityName, states };
    }).filter((e) => e.states.length > 0);

    return (
        <div className="help-stack">
            <p className="help-intro">{t("help.statuses.intro")}</p>
            {entities.length === 0 ? <p className="help-empty">{t("help.no_results").replace("{q}", query)}</p> : null}
            {entities.map(({ id, ent, entityName, states }) => (
                <section key={id} className="help-card" aria-labelledby={`help-st-${id}`}>
                    <header className="help-card__head">
                        <h3 id={`help-st-${id}`} className="help-card__title">
                            {entityName}
                        </h3>
                        <span className="help-card__meta">
                            {t("help.statuses.initial")}: {t(statusLabelKey(id, ent.initial))}
                        </span>
                    </header>
                    <div className="data-table-wrap">
                        <table className="tbl data-table">
                            <thead>
                                <tr>
                                    <th scope="col">{t("help.statuses.col_status")}</th>
                                    <th scope="col">{t("help.statuses.col_meaning")}</th>
                                    <th scope="col">{t("help.statuses.col_phase")}</th>
                                    <th scope="col">{t("help.statuses.col_next")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {states.map((st) => (
                                    <tr key={st.wire}>
                                        <td>
                                            <StatusBadge entity={id} status={st.wire} />
                                        </td>
                                        <td>{t(statusDescriptionKey(id, st.wire))}</td>
                                        <td className="data-table__muted">{t(`status.phase.${st.phase}`)}</td>
                                        <td>
                                            {st.terminal ? (
                                                <span className="data-table__muted">{t("help.statuses.final")}</span>
                                            ) : (
                                                <span className="help-chip-row">
                                                    {st.next.map((n) => (
                                                        <StatusBadge key={n} entity={id} status={n} />
                                                    ))}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {ent.flags?.length ? (
                        <p className="help-card__foot">
                            <strong>{t("help.statuses.flags")}:</strong>{" "}
                            {ent.flags.map((f) => t(statusFlagLabelKey(id, f))).join(" · ")}
                        </p>
                    ) : null}
                </section>
            ))}
        </div>
    );
}
