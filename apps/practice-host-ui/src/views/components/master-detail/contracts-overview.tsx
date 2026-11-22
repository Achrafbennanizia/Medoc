/** Contracts page, right-hand part while no contract is selected: active count and monthly cost. */
import { useT } from "@/lib/i18n";
import { amountEquivalentPerMonth, contractActiveToday, type ContractItem } from "@/lib/contract-domain";
import { formatCurrency } from "@/lib/utils";
import { Button } from "../ui/button";
import { MasterDetailOverview } from "./master-detail-overview";

export function ContractsOverview({ contracts, onCreate }: { contracts: ContractItem[]; onCreate?: () => void }) {
    const t = useT();
    const active = contracts.filter(contractActiveToday);
    const monthly = active.reduce((sum, c) => sum + amountEquivalentPerMonth(c.amount, c.interval), 0);
    return (
        <MasterDetailOverview
            title={t("page.administration.contracts.overview.title")}
            facts={[
                { label: t("page.administration.contracts.overview.active"), value: `${active.length} / ${contracts.length}` },
                { label: t("page.administration.contracts.overview.monthly"), value: formatCurrency(monthly) },
            ]}
            hint={t("page.administration.contracts.overview.hint")}
            action={onCreate ? <Button type="button" onClick={onCreate}>{t("page.administration.contracts.btn.create")}</Button> : null}
        />
    );
}
