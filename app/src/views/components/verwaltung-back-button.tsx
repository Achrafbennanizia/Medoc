import { useLocation, useNavigate } from "react-router-dom";
import { getVerwaltungBackTarget } from "@/lib/verwaltung-hierarchy";
import { ChevronLeftIcon } from "@/lib/icons";

type Props = { className?: string };

/** Subtle back control: one level up in the Verwaltung hierarchy (not always the root). */
export function VerwaltungBackButton({ className }: Props) {
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    const { path, label } = getVerwaltungBackTarget(pathname + (search || ""));

    return (
        <button
            type="button"
            className={className ?? "btn btn-subtle"}
            onClick={() => navigate(path)}
        >
            <ChevronLeftIcon />
            {" "}
            {label}
        </button>
    );
}
