/**
 * Role and privileges of one staff member (Administration → Team → Staff). Pick a predefined role,
 * then adjust single areas within the login role's ceiling; the calendar can be limited to the
 * person's own appointments. Saved on the main device (forwarded from a replica).
 */
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import type { AccessAreaId } from "@/systems/practice-host/controllers/access.controller";
import { AccessAreaRow } from "../access/access-area-row";
import { roleDescriptionKey, roleLabelKey } from "../access/access-labels";
import { useAccessCatalog } from "../access/use-access-catalog";
import { Button } from "../ui/button";
import { useStaffAccess } from "./use-staff-access";

export function StaffAccessPanel({ staffId }: { staffId: string }) {
    const t = useT();
    const tp = useTParams();
    const { catalog, error: catalogError } = useAccessCatalog();
    const s = useStaffAccess(staffId, catalog);
    const loadError = catalogError ?? (s.access ? null : s.error);

    if (loadError) return <p className="page-sub">{tp("access.panel.load_failed", { message: errorMessage(loadError) })}</p>;
    if (!catalog || !s.access || !s.draft) return <p className="page-sub">{t("common.loading")}</p>;

    const loginRole = s.access.role;
    const roles = catalog.roles.filter((r) => r.baseRole === loginRole);
    const role = roles.find((r) => r.id === s.draft?.role);
    const ceilings = catalog.ceilings[loginRole] ?? {};
    const readOnly = s.placement === "unavailable";

    return (
        <section className="staff-detail-card__section access-panel" aria-labelledby="access-panel-title">
            <h3 id="access-panel-title" className="text-title">
                {t("access.panel.title")}
            </h3>
            <p className="page-sub">{t("access.panel.intro")}</p>
            <p className="access-panel__where" data-placement={s.placement}>
                {t(`access.panel.where.${s.placement}`)}
            </p>

            <label className="access-panel__role">
                <span className="access-row__area">{t("access.panel.role")}</span>
                <select className="input" value={s.draft.role} disabled={readOnly || s.busy} onChange={(e) => s.pickRole(e.target.value)}>
                    {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                            {t(roleLabelKey(r.id))}
                        </option>
                    ))}
                </select>
            </label>
            {role ? <p className="page-sub">{t(roleDescriptionKey(role.id))}</p> : null}

            <div className="access-panel__grid">
                {catalog.areas.map(({ area, scopable }) => (
                    <AccessAreaRow
                        key={area}
                        area={area}
                        level={s.draft?.levels[area] ?? "none"}
                        roleLevel={role?.levels[area]}
                        ceiling={ceilings[area] ?? "none"}
                        scopable={scopable}
                        own={s.draft?.own.includes(area as AccessAreaId) ?? false}
                        disabled={readOnly || s.busy}
                        onLevel={(l) => s.setLevel(area, l)}
                        onOwn={(own) => s.setOwn(area, own)}
                    />
                ))}
            </div>

            {s.error ? <p className="access-panel__error" role="alert">{errorMessage(s.error)}</p> : null}
            <div className="row access-panel__actions">
                <Button type="button" variant="ghost" disabled={readOnly || s.busy || s.access.usesRoleDefault} onClick={() => void s.reset()}>
                    {t("access.panel.reset")}
                </Button>
                <Button type="button" loading={s.busy} disabled={readOnly || s.busy || !s.dirty} onClick={() => void s.save()}>
                    {t("access.panel.save")}
                </Button>
            </div>
        </section>
    );
}
