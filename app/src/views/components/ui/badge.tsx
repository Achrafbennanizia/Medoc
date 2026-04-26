type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "purple";

interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
    const map = { default: "grey", primary: "accent", success: "green", warning: "orange", error: "red", purple: "purple" } as const;
    return <span className={`pill ${map[variant]} ${className ?? ""}`}>{children}</span>;
}
