/** Frame of the payment form: own page card, or embedded in Finance / the cash desk. */
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";

export function PaymentFinanceOrPageWrap({
    isFinance,
    embedVariant,
    onClose,
    children,
}: {
    isFinance: boolean;
    embedVariant?: "finance" | "cash";
    onClose: () => void;
    children: ReactNode;
}) {
    const t = useT();
    if (!isFinance) {
        return (
            <Card className="payment-create-page__card card-elevated">
                <CardHeader
                    title={t("payment.create.payment_data")}
                    subtitle={t("payment.create.subtitle")}
                />
                <div className="card-pad">{children}</div>
            </Card>
        );
    }
    const subtitle =
        embedVariant === "cash"
            ? t("payment.create.embed_cash_sub")
            : t("payment.create.embed_finance_sub");
    return (
        <Card className="products-detail-card payment-finance-embed card--overflow-visible">
            <CardHeader
                title={t("payment.create.title")}
                subtitle={subtitle}
                action={(
                    <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                        {t("common.close")}
                    </Button>
                )}
            />
            <div className="card-pad payment-finance-embed__body">{children}</div>
        </Card>
    );
}
