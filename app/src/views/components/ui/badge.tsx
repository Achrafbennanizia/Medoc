import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "purple";

interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-surface-container text-on-surface",
    primary: "bg-primary-container text-primary",
    success: "bg-success-container text-success",
    warning: "bg-warning-container text-warning",
    error: "bg-error-container text-error",
    purple: "bg-accent-purple/15 text-accent-purple",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-md text-label font-medium",
                variantStyles[variant],
                className,
            )}
        >
            {children}
        </span>
    );
}
