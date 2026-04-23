import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
    children: ReactNode;
    className?: string;
    elevated?: boolean;
}

export function Card({ children, className, elevated }: CardProps) {
    return (
        <div className={cn(elevated ? "card-elevated" : "card", "p-5", className)}>
            {children}
        </div>
    );
}

interface CardHeaderProps {
    title: string;
    action?: ReactNode;
}

export function CardHeader({ title, action }: CardHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-title text-on-primary">{title}</h3>
            {action}
        </div>
    );
}
