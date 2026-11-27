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

/** Type + kind + doctor + collected-by filters for the finance list. */
export function FinanceTxFilters(props: {
    fd: FinanceDoctors;
    txTab: string;
    kindFilter: string;
    doctorFilter: string;
    collectedBy: string;
    hiddenDoctors: readonly string[];
    txTabOptions: readonly Option<string>[];
    kindOptions: readonly Option<string>[];
    onTxTab: (v: string) => void;
    onKind: (v: string) => void;
    onDoctor: (v: string) => void;
    onCollectedBy: (v: string) => void;
}) {
    const t = useT();
    return (
        <div className="finance-tx-filter-selects">
            <FinanceFilterSelect label={t("page.finance.filter_label_type")} ariaLabel={t("page.finance.aria_filter_type")} value={props.txTab} options={props.txTabOptions} onChange={props.onTxTab} />
            <FinanceFilterSelect label={t("page.finance.filter_label_kind")} ariaLabel={t("page.finance.aria_filter_kind")} value={props.kindFilter} options={props.kindOptions} onChange={props.onKind} />
            <FinanceDoctorFilter fd={props.fd} value={props.doctorFilter} onChange={props.onDoctor} hidden={props.hiddenDoctors} />
            <FinanceCollectedByFilter fd={props.fd} value={props.collectedBy} onChange={props.onCollectedBy} />
        </div>
    );
}


/** `hidden`: doctors who do not share payments with the viewer (picking them would be refused). */
export function FinanceDoctorFilter({ fd, value, onChange, hidden = [] }: { fd: FinanceDoctors; value: string; onChange: (id: string) => void; hidden?: readonly string[] }) {
    const t = useT();
    if (!fd.show) return null;
    return (
        <FinanceFilterSelect
            label={t("page.finance.filter_label_doctor")}
            ariaLabel={t("page.finance.filter_label_doctor")}
            value={value}
            options={[{ value: "", label: t("page.finance.all_doctors") }, ...fd.doctors.filter((d) => !hidden.includes(d.id)).map((d) => ({ value: d.id, label: d.name }))]}
            onChange={onChange}
        />
    );
}

/** Who took the money at the desk (Cabinet+). */
export function FinanceCollectedByFilter({ fd, value, onChange }: { fd: FinanceDoctors; value: string; onChange: (id: string) => void }) {
    const t = useT();
    if (!fd.show) return null;
    return (
        <FinanceFilterSelect
            label={t("page.finance.filter_label_collected_by")}
            ariaLabel={t("page.finance.filter_label_collected_by")}
            value={value}
            options={[{ value: "", label: t("page.finance.all_collectors") }, ...fd.collectors.map((d) => ({ value: d.id, label: d.name }))]}
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
