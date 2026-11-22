/** One area of a person's privileges: level (capped by the login role's ceiling) and, where it
 *  applies, "own records only". Shows what the chosen level allows. */
import { useT } from "@/lib/i18n";
import type { AccessAreaId, AccessLevel } from "@/systems/practice-host/controllers/access.controller";
import { areaLabelKey, LEVEL_ORDER, levelLabelKey, levelRank, privilegeKey } from "./access-labels";

type Props = {
    area: AccessAreaId;
    level: AccessLevel;
    roleLevel: AccessLevel | undefined;
    ceiling: AccessLevel;
    scopable: boolean;
    own: boolean;
    disabled: boolean;
    onLevel: (level: AccessLevel) => void;
    onOwn: (own: boolean) => void;
};

export function AccessAreaRow({ area, level, roleLevel, ceiling, scopable, own, disabled, onLevel, onOwn }: Props) {
    const t = useT();
    const changed = roleLevel !== undefined && roleLevel !== level;
    const id = `access-${area}`;
    return (
        <div className="access-row" data-changed={changed || undefined}>
            <div className="access-row__head">
                <label htmlFor={id} className="access-row__area">
                    {t(areaLabelKey(area))}
                </label>
                {changed ? <span className="pill yellow">{t("access.panel.changed_from_role")}</span> : null}
            </div>
            <select id={id} className="input access-row__level" value={level} disabled={disabled} onChange={(e) => onLevel(e.target.value as AccessLevel)}>
                {LEVEL_ORDER.filter((l) => levelRank(l) <= levelRank(ceiling)).map((l) => (
                    <option key={l} value={l}>
                        {t(levelLabelKey(l))}
                    </option>
                ))}
            </select>
            <p className="access-row__what">{level === "none" ? t("access.panel.no_access") : t(privilegeKey(area, level))}</p>
            {scopable && level !== "none" ? (
                <label className="access-row__scope">
                    <input type="checkbox" checked={own} disabled={disabled} onChange={(e) => onOwn(e.target.checked)} />
                    <span>{t(`access.scope.${area}.own`)}</span>
                </label>
            ) : null}
        </div>
    );
}
