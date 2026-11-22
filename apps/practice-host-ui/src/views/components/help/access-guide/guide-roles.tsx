/** Predefined roles: description and level per area, side by side. */
import { useT } from "@/lib/i18n";
import type { AccessCatalog } from "@/systems/practice-host/controllers/access.controller";
import { areaLabelKey, levelLabelKey, roleDescriptionKey, roleLabelKey } from "../../access/access-labels";

export function GuideRoles({ catalog }: { catalog: AccessCatalog }) {
    const t = useT();
    return (
        <div className="access-guide__matrix-wrap">
            <table className="tbl access-guide__matrix">
                <thead>
                    <tr>
                        <th scope="col">{t("access.panel.role")}</th>
                        {catalog.areas.map(({ area }) => (
                            <th key={area} scope="col">
                                {t(areaLabelKey(area))}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {catalog.roles.map((role) => (
                        <tr key={role.id}>
                            <th scope="row">
                                <b>{t(roleLabelKey(role.id))}</b>
                                <span className="access-guide__role-kind">{t(`access.login_role.${role.baseRole}`)}</span>
                                <span className="access-guide__role-desc">{t(roleDescriptionKey(role.id))}</span>
                            </th>
                            {catalog.areas.map(({ area }) => {
                                const level = role.levels[area] ?? "none";
                                return (
                                    <td key={area} data-level={level}>
                                        {t(levelLabelKey(level))}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
