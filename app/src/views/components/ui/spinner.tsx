import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SpinnerSize = "sm" | "md" | "lg";

export function Spinner({
    className,
    size = "md",
    ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, "role"> & { size?: SpinnerSize }) {
    return (
        <div
            className={cn(
                "ui-spinner",
                size === "sm" && "ui-spinner--sm",
                size === "lg" && "ui-spinner--lg",
                className,
            )}
            role="status"
            aria-hidden
            {...rest}
        />
    );
}
