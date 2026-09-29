import type { ReactNode } from "react";

export function DentalOdontogramAxis({
    slot,
    children,
}: {
    slot: "top" | "bottom" | "start" | "end";
    children: ReactNode;
}) {
    return (
        <span className={`dental-odontogram__axis dental-odontogram__axis--${slot}`} aria-hidden>
            <span className="dental-odontogram__axis-glyph">{children}</span>
        </span>
    );
}
