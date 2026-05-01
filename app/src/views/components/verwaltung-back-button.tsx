import { useLocation, useNavigate } from "react-router-dom";
import { getVerwaltungBackTarget } from "@/lib/verwaltung-hierarchy";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { ChevronLeftIcon } from "@/lib/icons";

type Props = { className?: string };

/** Subtle back control: one level up in the Verwaltung hierarchy (not always the root). */
export function VerwaltungBackButton({ className }: Props) {
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    const rolle = useAuthStore((s) => s.session?.rolle);
    const role = parseRole(rolle);
    const { path, label } = getVerwaltungBackTarget(pathname + (search || ""));

    if (path === "/" && (!role || !allowed("dashboard.read", role))) {
        return null;
    }

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
