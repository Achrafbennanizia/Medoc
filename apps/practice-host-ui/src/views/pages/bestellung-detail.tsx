import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageLoading } from "../components/ui/page-status";

/** Legacy route — opens list with side drawer instead of full-page detail. */
export function BestellungDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (id) {
            navigate(`/bestellungen?bestellung=${encodeURIComponent(id)}`, { replace: true });
        } else {
            navigate("/bestellungen", { replace: true });
        }
    }, [id, navigate]);

    return <PageLoading label="Bestellung wird geöffnet…" />;
}
