/** KPI tile: icon, label, value and an optional trend line (General page, Analytics). */
import { NAV_ICONS } from "@/lib/icons";
import { kpiIconChrome } from "@/lib/kpi-icon-chrome";
import { kpiValueSizeClass } from "@/lib/utils";

export interface StatCardProps {
    label: string;
    value: string;
    icon: string;
    accent: string;
    sub?: string;
    trend?: "positive" | "negative" | "neutral";
}

export function StatCard({ label, value, icon, accent, sub, trend = "neutral" }: StatCardProps) {
    const Ic = NAV_ICONS[icon] ?? NAV_ICONS["/"];
    const iconChrome = kpiIconChrome(accent);
    return (
        <div className="card kpi">
            <div className="kpi-label">
                <span style={{ width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", ...iconChrome }}>
                    <Ic size={13} />
                </span>
                {label}
            </div>
            <div className={kpiValueSizeClass(value)}>{value}</div>
            {sub ? (
                <div className="kpi-delta">
                    <span
                        className={
                            trend === "positive"
                                ? "kpi-delta__trend--positive"
                                : trend === "negative"
                                  ? "kpi-delta__trend--negative"
                                  : ""
                        }
                        style={trend === "neutral" ? { color: "var(--fg-3)" } : undefined}
                    >
                        {sub}
                    </span>
                </div>
            ) : null}
        </div>
    );
}
