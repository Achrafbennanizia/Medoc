/**
 * Group (editions-plan.md §4.5): the owner of one record makes it private or hides it from chosen
 * people. Shown only to the record's owner; the backend enforces it (`record_visibility_set`).
 * Other editions have one dentist and render nothing.
 */
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useAuthStore } from "@/models/store/auth-store";
import type { Staff } from "@/models/types";
import {
    getRecordVisibility,
    setRecordVisibility,
    type RecordRule,
} from "@/systems/practice-host/controllers/allowances.controller";
import { listStaff } from "@/systems/practice-host/controllers/staff.controller";
import { Select } from "@/views/components/ui/input";

type Mode = "shared" | "private" | "hidden_from";

function modeOf(rule: RecordRule | null): Mode {
    return rule?.kind ?? "shared";
}

export function RecordPrivacy({
    entityTable,
    entityId,
    ownerId,
}: {
    entityTable:
        | "appointment"
        | "examination"
        | "treatment"
        | "prescription"
        | "certificate"
        | "practice_task";
    entityId: string;
    ownerId: string | null | undefined;
}) {
    const me = useAuthStore((s) => s.session?.user_id);
    const isOwner = __CAP_ALLOWANCES__ && !!me && me === ownerId;
    const t = useT();
    const [rule, setRule] = useState<RecordRule | null>(null);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOwner) return;
        void getRecordVisibility(entityTable, entityId)
            .then(setRule)
            .catch((e: unknown) => setError(errorMessage(e)));
    }, [isOwner, entityTable, entityId]);

    const mode = modeOf(rule);
    useEffect(() => {
        if (!isOwner || mode !== "hidden_from" || staff.length) return;
        void listStaff()
            .then((list) => setStaff(list.filter((s) => s.id !== me)))
            .catch((e: unknown) => setError(errorMessage(e)));
    }, [isOwner, mode, staff.length, me]);

    if (!isOwner) return null;

    const save = async (next: RecordRule | null) => {
        setBusy(true);
        setError(null);
        try {
            await setRecordVisibility(entityTable, entityId, next);
            setRule(next);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    const hidden = rule?.kind === "hidden_from" ? rule.staff : [];

    return (
        <div className="record-privacy">
            <Select
                label={t("record_privacy.label")}
                value={mode}
                disabled={busy}
                options={(["shared", "private", "hidden_from"] as const).map((value) => ({
                    value,
                    label: t(`record_privacy.mode.${value}`),
                }))}
                onChange={(e) => {
                    const next = e.target.value as Mode;
                    if (next === "shared") void save(null);
                    else if (next === "private") void save({ kind: "private" });
                    else setRule({ kind: "hidden_from", staff: hidden });
                }}
            />
            {mode === "hidden_from" ? (
                <fieldset className="record-privacy__people" disabled={busy}>
                    <legend>{t("record_privacy.hide_from")}</legend>
                    {staff.map((s) => (
                        <label key={s.id} className="record-privacy__person">
                            <input
                                type="checkbox"
                                checked={hidden.includes(s.id)}
                                onChange={(e) => {
                                    const people = e.target.checked
                                        ? [...hidden, s.id]
                                        : hidden.filter((id) => id !== s.id);
                                    void save(people.length ? { kind: "hidden_from", staff: people } : null);
                                }}
                            />
                            {s.name}
                        </label>
                    ))}
                </fieldset>
            ) : null}
            {error ? <p className="record-privacy__error" role="alert">{error}</p> : null}
        </div>
    );
}
