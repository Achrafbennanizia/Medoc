/** Optional ordered-for / paid-by / approved-by pickers (Cabinet+ T5.4). */
import { useT } from "@/lib/i18n";
import { Select } from "../components/ui/input";
import type { DoctorList } from "../components/use-doctor-list";

export function PurchaseOrderCreateDoctorFields({
    doctors,
    orderedForStaffId,
    paidByStaffId,
    approvedByStaffId,
    onOrderedFor,
    onPaidBy,
    onApprovedBy,
}: {
    doctors: DoctorList;
    orderedForStaffId: string;
    paidByStaffId: string;
    approvedByStaffId: string;
    onOrderedFor: (id: string) => void;
    onPaidBy: (id: string) => void;
    onApprovedBy: (id: string) => void;
}) {
    const t = useT();
    if (!doctors.show) return null;
    const optional = t("page.purchase_order.create.doctor_optional");
    const options = [
        { value: "", label: optional },
        ...doctors.doctors.map((d) => ({ value: d.id, label: d.name })),
    ];
    return (
        <div className="purchase-order-create-form__grid purchase-order-create-form__grid--2">
            <Select
                id="bc-ordered-for"
                label={t("page.purchase_order.create.ordered_for")}
                value={orderedForStaffId}
                onChange={(e) => onOrderedFor(e.target.value)}
                options={options}
            />
            <Select
                id="bc-paid-by"
                label={t("page.purchase_orders.col_paid_by")}
                value={paidByStaffId}
                onChange={(e) => onPaidBy(e.target.value)}
                options={options}
            />
            <Select
                id="bc-approved-by"
                label={t("page.purchase_orders.col_approved_by")}
                value={approvedByStaffId}
                onChange={(e) => onApprovedBy(e.target.value)}
                options={options}
            />
        </div>
    );
}
