/**
 * Cabinet+ doctor filter / columns for the orders list (T5.4). Hidden when there is only one
 * dentist (Essentiel / Cabinet).
 */
import { useT, useTParams } from "@/lib/i18n";
import type { DoctorList } from "../components/use-doctor-list";
import type { PurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import { Select } from "../components/ui/input";

export type OrderDoctors = DoctorList;

export function OrderDoctorFilter({
    od,
    value,
    onChange,
    hidden = [],
}: {
    od: OrderDoctors;
    value: string;
    onChange: (id: string) => void;
    /** Doctors who do not share orders with the viewer: picking them would only be refused. */
    hidden?: readonly string[];
}) {
    const t = useT();
    if (!od.show) return null;
    return (
        <div className="page-toolbar__filters" style={{ width: 200, maxWidth: "100%" }}>
            <Select
                id="order-doctor"
                aria-label={t("page.purchase_orders.filter_doctor_aria")}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                options={[
                    { value: "", label: t("page.purchase_orders.all_doctors") },
                    ...od.doctors.filter((d) => !hidden.includes(d.id)).map((d) => ({ value: d.id, label: d.name })),
                ]}
            />
        </div>
    );
}

export function OrderDoctorCell({ od, order }: { od: OrderDoctors; order: PurchaseOrder }) {
    const t = useT();
    const tp = useTParams();
    if (!od.show) return null;
    const forName = od.nameOf(order.ordered_for_staff_id);
    const paid = od.nameOf(order.paid_by_staff_id);
    const approved = od.nameOf(order.approved_by);
    return (
        <span className="data-table__stack">
            <span className="data-table__primary">{forName ? tp("page.purchase_orders.ordered_for", { name: forName }) : "—"}</span>
            {paid ? <span className="data-table__secondary">{t("page.purchase_orders.col_paid_by")}: {paid}</span> : null}
            {approved ? <span className="data-table__secondary">{t("page.purchase_orders.col_approved_by")}: {approved}</span> : null}
        </span>
    );
}

export function OrderHiddenDoctorsNote({ od, ids }: { od: OrderDoctors; ids: readonly string[] }) {
    const tp = useTParams();
    if (!od.show || ids.length === 0) return null;
    const names = ids.map((id) => od.nameOf(id) ?? id).join(", ");
    return (
        <p className="card-sub" role="status" style={{ margin: "0 0 var(--space-2)" }}>
            {tp("page.purchase_orders.not_shared_by", { names })}
        </p>
    );
}
