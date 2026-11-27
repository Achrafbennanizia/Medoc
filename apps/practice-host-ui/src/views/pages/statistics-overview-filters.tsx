/** Treatment-type and payment-method filters for the statistics page (T5.6). */
import type { PaymentMethod } from "@/models/types";
import { paymentMethodLabel } from "@/lib/finance-order-labels";
import { PAYMENT_KIND_VALUES } from "@/lib/payment-booking";
import { useT } from "@/lib/i18n";
import { Select } from "../components/ui/input";
import type { TreatmentKindOption } from "./statistics-treatment-kind-options";

export function StatisticsOverviewFilters({
    treatmentKind,
    paymentMethod,
    treatmentOptions,
    onTreatmentKind,
    onPaymentMethod,
}: {
    treatmentKind: string;
    paymentMethod: "" | PaymentMethod;
    treatmentOptions: TreatmentKindOption[];
    onTreatmentKind: (value: string) => void;
    onPaymentMethod: (value: "" | PaymentMethod) => void;
}) {
    const t = useT();
    return (
        <>
            {treatmentOptions.length > 0 ? (
                <Select
                    id="statistics-treatment-kind"
                    label={t("page.statistics.filter_treatment_type")}
                    value={treatmentKind}
                    onChange={(e) => onTreatmentKind(e.target.value)}
                    options={[
                        { value: "", label: t("page.statistics.filter_treatment_all") },
                        ...treatmentOptions,
                    ]}
                />
            ) : null}
            <Select
                id="statistics-payment-method"
                label={t("page.statistics.filter_payment_method")}
                value={paymentMethod}
                onChange={(e) => onPaymentMethod(e.target.value as "" | PaymentMethod)}
                options={[
                    { value: "", label: t("page.statistics.filter_payment_all") },
                    ...PAYMENT_KIND_VALUES.map((value) => ({
                        value,
                        label: paymentMethodLabel(value, t),
                    })),
                ]}
            />
        </>
    );
}