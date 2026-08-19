import { useLocation, useNavigate } from "react-router-dom";
import { getAdministrationBackTarget } from "@/lib/administration-hierarchy";
import { useT } from "@/lib/i18n";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { ChevronLeftIcon } from "@/lib/icons";

type Props = { className?: string };

/** Subtle back control: one level up in the Administration hierarchy (not always the root). */
export function AdministrationBackButton({ className }: Props) {
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    const role = useAuthStore((s) => s.session?.role);
    const parsedRole = parseRole(role);
    const t = useT();
    const normalizedPath = (pathname.replace(/\/$/, "") || "/");

    if (normalizedPath === "/administration") {
        return null;
    }

    const { path, labelKey } = getAdministrationBackTarget(pathname + (search || ""));

    if (path === "/" && (!parsedRole || !allowed("dashboard.read", parsedRole))) {
        return null;
    }

    return (
        <button
            type="button"
            className={className ?? "btn btn-subtle workspace-page-back-button administration-back-button"}
            onClick={() => navigate(path)}
        >
            <ChevronLeftIcon />
            {" "}
            {t(labelKey)}
        </button>
    );
}
