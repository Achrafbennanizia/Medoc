/**
 * Group: person-bound forms show For: me / Dr B / both when Allowances allow (editions-plan §6.15).
 * "Both" means every allowed dentist target; the caller writes one row (or schedule) per id.
 */
import { useEffect, useMemo, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { DOCTOR_CONTEXT } from "@/lib/doctor-context";
import { useAuthStore } from "@/models/store/auth-store";
import { listAllowances } from "@/systems/practice-host/controllers/allowances.controller";
import { listPhysicians, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { Select } from "@/views/components/ui/input";

export type StaffTargetChoice = "me" | "other" | "both";

export function StaffTargetSelector({
    value,
    onChange,
    area = "work_hours",
}: {
    value: StaffTargetChoice;
    onChange: (next: StaffTargetChoice, staffIds: string[]) => void;
    /** Change-rule area that gates editing another dentist's person-bound data. */
    area?: "work_hours" | "calendar";
}) {
    const t = useT();
    const tp = useTParams();
    const me = useAuthStore((s) => s.session?.user_id);
    const [physicians, setPhysicians] = useState<PhysicianSummary[]>([]);
    const [allowedOtherIds, setAllowedOtherIds] = useState<string[]>([]);

    useEffect(() => {
        if (!DOCTOR_CONTEXT.showDoctorUi || !me) return;
        let cancelled = false;
        void Promise.all([listPhysicians(), listAllowances()])
            .then(([docs, owners]) => {
                if (cancelled) return;
                setPhysicians(docs);
                const others = docs.filter((d) => d.id !== me).map((d) => d.id);
                const canEdit = (ownerId: string) => {
                    const owner = owners.find((o) => o.staffId === ownerId);
                    if (!owner) return false;
                    const rule = owner.rules.change[area];
                    if (!rule) return false;
                    if (rule.kind === "everyone" || rule.kind === "me_and_other_admin") return true;
                    if (rule.kind === "me_admin_and") return true;
                    return false;
                };
                setAllowedOtherIds(others.filter(canEdit));
            })
            .catch(() => {
                if (!cancelled) setAllowedOtherIds([]);
            });
        return () => {
            cancelled = true;
        };
    }, [me, area]);

    const otherName = useMemo(() => {
        const names = physicians.filter((p) => allowedOtherIds.includes(p.id)).map((p) => p.name);
        return names.join(", ");
    }, [physicians, allowedOtherIds]);

    if (!DOCTOR_CONTEXT.showDoctorUi || !me || physicians.length < 2) return null;

    const resolve = (choice: StaffTargetChoice): string[] => {
        if (choice === "me") return [me];
        if (choice === "other") return allowedOtherIds.slice(0, 1);
        return [me, ...allowedOtherIds];
    };

    const options = [
        { value: "me", label: t("staff_target.me") },
        ...(allowedOtherIds.length
            ? [
                  {
                      value: "other",
                      label: otherName
                          ? tp("staff_target.other_named", { doctor: otherName })
                          : t("staff_target.other"),
                  },
              ]
            : []),
        ...(allowedOtherIds.length ? [{ value: "both", label: t("staff_target.both") }] : []),
    ];

    if (options.length < 2) return null;

    return (
        <Select
            id="staff-target"
            label={t("staff_target.label")}
            value={value}
            options={options}
            onChange={(e) => {
                const next = e.target.value as StaffTargetChoice;
                onChange(next, resolve(next));
            }}
        />
    );
}
