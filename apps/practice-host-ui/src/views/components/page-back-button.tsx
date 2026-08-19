import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "@/lib/icons";

type Props = {
    label: string;
    to?: string;
    onClick?: () => void;
    className?: string;
};

/** Compact back control — same look as Administration back (`btn btn-subtle`). */
export function PageBackButton({ label, to, onClick, className }: Props) {
    const cls = className ?? "btn btn-subtle workspace-page-back-button";
    if (to) {
        return (
            <Link to={to} className={cls}>
                <ChevronLeftIcon />
                {" "}
                {label}
            </Link>
        );
    }
    return (
        <button type="button" className={cls} onClick={onClick}>
            <ChevronLeftIcon />
            {" "}
            {label}
        </button>
    );
}
