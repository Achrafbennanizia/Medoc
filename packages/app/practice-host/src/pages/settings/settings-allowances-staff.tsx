/**
 * Settings → Sharing staff section (editions-plan §6.15): one row per staff member,
 * summary of what they see of each dentist's data, with Chosen lists editable for me.
 */
import { useEffect, useMemo, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
    setAllowance,
    SHARE_AREAS,
    type OwnerAllowances,
    type ShareArea,
    type ViewRule,
} from "@/systems/practice-host/controllers/allowances.controller";
import { listStaff } from "@/systems/practice-host/controllers/staff.controller";
import type { Staff } from "@/models/types";
import { useToastStore } from "@/views/components/ui/toast-store";

function areasSeenBy(owner: OwnerAllowances, staffId: string): ShareArea[] {
    return SHARE_AREAS.filter((area) => {
        const rule = owner.rules.view[area];
        if (!rule) return false;
        if (rule.kind === "everyone") return true;
        if (rule.kind === "chosen") return rule.staff.includes(staffId);
        return false;
    });
}

export function SettingsAllowancesStaff({
    owners,
    onOwners,
}: {
    owners: OwnerAllowances[];
    onOwners: (next: OwnerAllowances[]) => void;
}) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);

    const me = owners.find((o) => o.isMe) ?? null;
    const others = useMemo(() => owners.filter((o) => !o.isMe), [owners]);

    useEffect(() => {
        void listStaff()
            .then((list) =>
                setStaff(
                    list.filter(
                        (s) =>
                            !owners.some((o) => o.staffId === s.id) &&
                            String(s.role).toUpperCase() !== "PHYSICIAN",
                    ),
                ),
            )
            .catch((e: unknown) => setError(errorMessage(e)));
    }, [owners]);

    if (!me || staff.length === 0) return null;

    const setStaffAreas = async (staffId: string, areas: ShareArea[]) => {
        setSaving(staffId);
        setError(null);
        try {
            let rules = me.rules;
            for (const area of SHARE_AREAS) {
                const current = rules.view[area];
                const want = areas.includes(area);
                const inChosen =
                    current.kind === "chosen" ? current.staff.includes(staffId) : false;
                const everyone = current.kind === "everyone";
                if (everyone && want) continue;
                if (!want && !inChosen && !everyone) continue;
                let next: ViewRule;
                if (want) {
                    if (everyone) continue;
                    const base =
                        current.kind === "chosen"
                            ? current.staff.filter((id) => id !== staffId)
                            : [];
                    next = { kind: "chosen", staff: [...base, staffId] };
                } else if (everyone) {
                    // Narrow from everyone to chosen = all other practice staff except this one —
                    // keep it simple: switch to chosen with only the remaining selected staff
                    // who were previously covered via everyone (other team members in the list).
                    const keep = staff.filter((s) => s.id !== staffId).map((s) => s.id);
                    next = keep.length ? { kind: "chosen", staff: keep } : { kind: "other_admin" };
                } else if (current.kind === "chosen") {
                    const rest = current.staff.filter((id) => id !== staffId);
                    next = rest.length ? { kind: "chosen", staff: rest } : { kind: "other_admin" };
                } else {
                    continue;
                }
                rules = await setAllowance({ kind: "view", area, rule: next });
            }
            onOwners(owners.map((o) => (o.isMe ? { ...o, rules } : o)));
            toast(t("settings.allowances.saved"), "success");
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setSaving(null);
        }
    };

    return (
        <section className="settings-allowances-staff" aria-labelledby="settings-allowances-staff-title">
            <h3 className="form-section-title" id="settings-allowances-staff-title">
                {t("settings.allowances.staff.title")}
            </h3>
            <p className="card-sub">{t("settings.allowances.staff.hint")}</p>
            {error ? (
                <p className="card-sub text-error" role="alert">
                    {error}
                </p>
            ) : null}
            <table className="settings-allowances__table">
                <thead>
                    <tr>
                        <th scope="col">{t("settings.allowances.staff.person")}</th>
                        <th scope="col">{t("settings.allowances.mine")}</th>
                        {others.map((o) => (
                            <th scope="col" key={o.staffId}>
                                {o.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {staff.map((s) => {
                        const mine = areasSeenBy(me, s.id);
                        return (
                            <tr key={s.id}>
                                <th scope="row">{s.name}</th>
                                <td>
                                    <fieldset className="settings-allowances-staff__areas" disabled={saving != null}>
                                        <legend className="sr-only">
                                            {tp("settings.allowances.staff.sees_mine", { name: s.name })}
                                        </legend>
                                        {SHARE_AREAS.map((area) => (
                                            <label key={area} className="settings-allowances-staff__area">
                                                <input
                                                    type="checkbox"
                                                    checked={mine.includes(area)}
                                                    onChange={(e) => {
                                                        const next = e.target.checked
                                                            ? [...mine, area]
                                                            : mine.filter((a) => a !== area);
                                                        void setStaffAreas(s.id, next);
                                                    }}
                                                />
                                                {t(`settings.allowances.area.${area}`)}
                                            </label>
                                        ))}
                                    </fieldset>
                                </td>
                                {others.map((o) => {
                                    const seen = areasSeenBy(o, s.id);
                                    return (
                                        <td key={o.staffId} className="settings-allowances__other">
                                            {seen.length === 0
                                                ? t("settings.allowances.staff.none")
                                                : seen.length === SHARE_AREAS.length
                                                  ? t("settings.allowances.staff.all")
                                                  : seen
                                                        .map((a) => t(`settings.allowances.area.${a}`))
                                                        .join(", ")}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
}
