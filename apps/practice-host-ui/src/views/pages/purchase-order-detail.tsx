import { useT } from "@/lib/i18n";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageLoading } from "../components/ui/page-status";

/** Legacy route — opens list with side drawer instead of full-page detail. */
export function PurchaseOrderDetailPage() {
    const t = useT();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (id) {
            navigate(`/purchase-orders?purchase_order=${encodeURIComponent(id)}`, { replace: true });
        } else {
            navigate("/purchase-orders", { replace: true });
        }
    }, [id, navigate]);

    return <PageLoading label={t("page.purchase_order.detail.loading")} />;
}
