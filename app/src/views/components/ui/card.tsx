import type { ReactNode } from "react";

interface CardProps {
    children: ReactNode;
    className?: string;
    elevated?: boolean;
}

export function Card({ children, className, elevated }: CardProps) {
    return <div className={`card ${elevated ? "card-elevated" : ""} ${className ?? ""}`}>{children}</div>;
}

interface CardHeaderProps {
    title: string;
    subtitle?: ReactNode;
    action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
    return (
        <div className="card-head">
            <div>
                <div className="card-title">{title}</div>
                {subtitle ? (
                    <div className="card-subtitle" style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                        {subtitle}
                    </div>
                ) : null}
            </div>
            {action}
        </div>
    );
}
