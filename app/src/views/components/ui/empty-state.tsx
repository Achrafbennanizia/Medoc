import type { ReactNode } from "react";

interface EmptyStateProps {
    /** Emoji or short string (used when `graphic` is not set). */
    icon?: string;
    /** Optional illustrated / icon block instead of emoji. */
    graphic?: ReactNode;
    /** Subtle vertical float on the graphic (4s loop); off when `prefers-reduced-motion: reduce`). */
    floatIllustration?: boolean;
    title: string;
    description?: string;
    /** Optional primary call-to-action rendered below the description. */
    action?: { label: string; onClick: () => void };
    className?: string;
}

export function EmptyState({ icon = "📋", graphic, floatIllustration, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={`empty-state-root ${className ?? ""}`}>
            {graphic ? (
                <div
                    className={["empty-state-graphic-wrap", floatIllustration ? "empty-state-graphic-wrap--float" : ""].filter(Boolean).join(" ")}
                >
                    {graphic}
                </div>
            ) : (
                <div className="empty-state-emoji" aria-hidden>
                    {icon}
                </div>
            )}
            <div className="empty-state-title">{title}</div>
            {description ? <div className="empty-state-desc">{description}</div> : null}
            {action ? (
                <div style={{ marginTop: 12 }}>
                    <button type="button" className="btn btn-accent" onClick={action.onClick}>
                        {action.label}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
