interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
}

export function EmptyState({ icon = "📋", title, description }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">{icon}</span>
            <p className="text-body-medium text-on-surface">{title}</p>
            {description && <p className="text-caption text-on-surface-variant mt-1">{description}</p>}
        </div>
    );
}
