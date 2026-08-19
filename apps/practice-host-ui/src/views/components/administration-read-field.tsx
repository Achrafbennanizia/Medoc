/** Compact label+value field — same read logic as "Prescriptions und Certificates vordefinieren" / products detail. */
export function AdministrationReadField({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.45 }}>{value || "—"}</span>
        </div>
    );
}
