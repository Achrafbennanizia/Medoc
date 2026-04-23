import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
    primary:
        "bg-primary text-on-accent hover:bg-primary-bright active:bg-primary-dim",
    secondary:
        "bg-primary-container text-primary hover:bg-surface-overlay active:bg-surface-container",
    ghost:
        "bg-transparent text-on-surface hover:bg-surface-bright active:bg-surface-container",
    danger:
        "bg-error-container text-error hover:bg-error/20 active:bg-error/30",
};

const sizeStyles: Record<Size, string> = {
    sm: "h-8 px-3 text-label gap-1.5 rounded-md",
    md: "h-9 px-4 text-body-medium gap-2 rounded-lg",
    lg: "h-10 px-5 text-body-medium gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={cn(
                "inline-flex items-center justify-center font-medium transition-colors duration-150 focus-ring select-none",
                "disabled:opacity-40 disabled:pointer-events-none",
                variantStyles[variant],
                sizeStyles[size],
                className,
            )}
            {...props}
        >
            {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            {children}
        </button>
    ),
);
Button.displayName = "Button";
