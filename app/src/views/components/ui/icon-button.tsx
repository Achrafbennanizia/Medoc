import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    children: ReactNode;
    /** Required: every icon-only control is labeled for AT (§2.4). */
    "aria-label": string;
};

/**
 * 34×34 hit target, `icon-btn` + focus ring. Prefer over raw `.icon-btn` in TSX.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ className, type = "button", children, ...props }, ref) => (
        <button ref={ref} type={type} className={cn("icon-btn focus-ring", className)} {...props}>
            {children}
        </button>
    ),
);
IconButton.displayName = "IconButton";
