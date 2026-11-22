/** Products page, right-hand part while no product is selected: product count and low stock. */
import { useT } from "@/lib/i18n";
import { isLowStock } from "@/lib/is-low-stock";
import type { Product } from "@/models/types";
import { Button } from "../ui/button";
import { MasterDetailOverview } from "./master-detail-overview";

export function ProductsOverview({ products, onCreate }: { products: Product[]; onCreate?: () => void }) {
    const t = useT();
    const low = products.filter(isLowStock).length;
    return (
        <MasterDetailOverview
            title={t("products.overview.title")}
            facts={[
                { label: t("products.overview.count"), value: products.length },
                { label: t("products.overview.low"), value: low, tone: low > 0 ? "warn" : undefined },
            ]}
            hint={onCreate ? t("products.panel_empty_write") : t("products.panel_empty_read")}
            action={onCreate ? <Button type="button" onClick={onCreate}>{t("products.new_btn")}</Button> : null}
        />
    );
}
