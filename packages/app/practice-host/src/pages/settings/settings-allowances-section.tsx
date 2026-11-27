/**
 * Settings → Sharing (Group, editions-plan.md §6.15). Everything is shared by default; each dentist
 * narrows what concerns them. Two tabs: who sees my data, who may change it. My column is editable,
 * the other dentists' columns are read-only so both see the same picture. Each choice saves at once.
 */
import { useEffect, useMemo, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
    changeRuleFrom,
    listAllowances,
    ruleValue,
    setAllowance,
    SHARE_AREAS,
    viewRuleFrom,
    type OwnerAllowances,
    type ShareArea,
} from "@/systems/practice-host/controllers/allowances.controller";
import { FilterOptionBar } from "@/views/components/ui/filter-option-bar";
import { Select } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { SettingsAllowancesStaff } from "./settings-allowances-staff";

type Tab = "view" | "change";

const VIEW_OPTIONS = ["everyone", "other_admin", "chosen", "nobody"] as const;
const CHANGE_OPTIONS = ["me", "me_and_other_admin", "me_admin_reception", "me_admin_staff", "everyone"] as const;

/** Practice data without an owner is always shared: these areas have no change rule. */
const CHANGE_AREAS: readonly ShareArea[] = ["calendar", "work_hours", "clinical", "documents", "payments", "tasks"];

export function SettingsAllowancesSection() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [owners, setOwners] = useState<OwnerAllowances[] | null>(null);
    const [tab, setTab] = useState<Tab>("view");
    const [saving, setSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void listAllowances()
            .then(setOwners)
            .catch((e: unknown) => setError(errorMessage(e)));
    }, []);

    const me = owners?.find((o) => o.isMe) ?? null;
    const others = useMemo(() => owners?.filter((o) => !o.isMe) ?? [], [owners]);
    const areas = tab === "view" ? SHARE_AREAS : CHANGE_AREAS;

    /**
     * Choices name the other dentist ("Dr. Alaoui and the team") instead of "everyone" / "the other
     * dentist". Each column reads from its owner's side, so the other dentist's column names me.
     */
    const optionLabel = (value: string, ownerId: string) => {
        const doctor = (owners ?? [])
            .filter((o) => o.staffId !== ownerId)
            .map((o) => o.name)
            .join(", ");
        return doctor
            ? tp(`settings.allowances.named.${tab}.${value}`, { doctor })
            : t(`settings.allowances.rule.${value}`);
    };
    const options = () =>
        (tab === "view" ? VIEW_OPTIONS : CHANGE_OPTIONS).map(
            (value) => ({ value, label: optionLabel(value, me?.staffId ?? "") }),
        );

    const save = async (area: ShareArea, value: string) => {
        if (!me) return;
        const key = `${tab}:${area}`;
        setSaving(key);
        setError(null);
        try {
            const rules = await setAllowance(
                tab === "view"
                    ? { kind: "view", area, rule: viewRuleFrom(value) }
                    : { kind: "change", area, rule: changeRuleFrom(value) },
            );
            setOwners((list) => list?.map((o) => (o.isMe ? { ...o, rules } : o)) ?? list);
            toast(t("settings.allowances.saved"), "success");
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setSaving(null);
        }
    };

    const valueOf = (o: OwnerAllowances, area: ShareArea) => ruleValue(tab === "view" ? o.rules.view[area] : o.rules.change[area]);

    return (
        <section className="settings-subcard settings-allowances" aria-labelledby="settings-allowances-title">
            <div className="card-head">
                <div>
                    <div className="card-title" id="settings-allowances-title">{t("settings.allowances.title")}</div>
                    <div className="card-sub">{t("settings.allowances.hint")}</div>
                </div>
            </div>
            <FilterOptionBar<Tab>
                ariaLabel={t("settings.allowances.tabs_aria")}
                value={tab}
                onChange={setTab}
                options={[
                    { value: "view", label: t("settings.allowances.tab.view") },
                    { value: "change", label: t("settings.allowances.tab.change") },
                ]}
            />
            {error ? (
                <p className="card-sub text-error" role="alert">
                    {error}
                </p>
            ) : null}
            {owners == null ? null : !me ? (
                <p className="card-sub">{t("settings.allowances.not_owner")}</p>
            ) : (
                <table className="settings-allowances__table">
                    <thead>
                        <tr>
                            <th scope="col">{t("settings.allowances.area")}</th>
                            <th scope="col">{t("settings.allowances.mine")}</th>
                            {others.map((o) => (
                                <th scope="col" key={o.staffId}>
                                    {o.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {areas.map((area) => (
                            <tr key={area}>
                                <th scope="row">
                                    <b>{t(`settings.allowances.area.${area}`)}</b>
                                    <div className="card-sub">{t(`settings.allowances.area_hint.${area}`)}</div>
                                </th>
                                <td>
                                    <Select
                                        id={`allowance-${tab}-${area}`}
                                        aria-label={`${t(`settings.allowances.area.${area}`)}: ${t("settings.allowances.mine")}`}
                                        value={valueOf(me, area)}
                                        options={options()}
                                        disabled={saving != null}
                                        onChange={(e) => void save(area, e.target.value)}
                                    />
                                </td>
                                {others.map((o) => (
                                    <td key={o.staffId} className="settings-allowances__other">
                                        {optionLabel(valueOf(o, area), o.staffId)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <p className="card-sub">{t("settings.allowances.footnote")}</p>
            {owners != null && me ? <SettingsAllowancesStaff owners={owners} onOwners={setOwners} /> : null}
        </section>
    );
}
