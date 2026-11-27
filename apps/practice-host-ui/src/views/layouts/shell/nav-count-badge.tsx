/** Count bubble on a sidebar entry (open tasks, charts to validate, guest proposals). */
export function NavCountBadge({ count, label }: { count: number; label: string }) {
    if (count <= 0) return null;
    return (
        <span className="count" aria-label={label}>
            {count > 99 ? "99+" : count}
        </span>
    );
}
