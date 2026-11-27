/**
 * Finance list pieces (T5.4). The filter select is shared by every filter on the page; the doctor
 * filter, the Doctor column and the "not shared" note exist only in Cabinet+ (several dentists,
 * doctor-context.ts). Essentiel and Cabinet have one dentist and show none of them.
 */
import { useId } from "react";
import { useT, useTParams } from "@/lib/i18n";
import type { Payment } from "@/models/types";
import type { FinanceDoctors } from "./finance-doctor-data";

type Option<V extends string> = { value: V; label: string };

export function FinanceFilterSelect<V extends string>(props: {
    label: string;
    ariaLabel: string;
    value: V;
    options: readonly Option<V>[];
    onChange: (value: V) => void;
}) {
    const id = useId();
    return (
        <div className="finance-tx-filter-select-field">
            <label htmlFor={id} className="finance-tx-filter-select__label">
                {props.label}
            </label>
            <select id={id} className="input-edit finance-tx-filter-select" value={props.value} aria-label={props.ariaLabel} onChange={(e) => props.onChange(e.target.value as V)}>
                {props.options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}


export function FinanceDoctorFilter({ fd, value, onChange }: { fd: FinanceDoctors; value: string; onChange: (id: string) => void }) {
    const t = useT();
    if (!fd.show) return null;
    return (
        <FinanceFilterSelect
            label={t("page.finance.filter_label_doctor")}
            ariaLabel={t("page.finance.filter_label_doctor")}
            value={value}
            options={[{ value: "", label: t("page.finance.all_doctors") }, ...fd.doctors.map((d) => ({ value: d.id, label: d.name }))]}
            onChange={onChange}
        />
    );
}

/** Doctor column: who the money is for, and who took it when that is someone else. */
export function FinanceDoctorCell({ fd, payment }: { fd: FinanceDoctors; payment?: Payment }) {
    const tp = useTParams();
    if (!fd.show) return null;
    const doctor = fd.nameOf(payment?.for_staff_id);
    const collector = payment?.collected_by && payment.collected_by !== payment.for_staff_id ? fd.nameOf(payment.collected_by) : undefined;
    return (
        <td className="fin-tx-td-doctor">
            <div className="finance-tx-v1">{doctor ?? "—"}</div>
            {collector ? <div className="finance-tx-v2">{tp("page.finance.collected_by", { name: collector })}</div> : null}
        </td>
    );
}

/** Says whose payments are missing instead of leaving them out silently (§6.15). */
export function FinanceHiddenDoctorsNote({ fd, ids }: { fd: FinanceDoctors; ids: readonly string[] }) {
    const tp = useTParams();
    if (!fd.show || ids.length === 0) return null;
    const names = ids.map((id) => fd.nameOf(id) ?? id).join(", ");
    return (
        <p className="card-sub" role="status" style={{ margin: "0 0 var(--space-2)" }}>
            {tp("page.finance.not_shared_by", { names })}
        </p>
    );
}
