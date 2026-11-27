/** KPI cards and helpers for the finance page (kept out of the oversized page file). */
import type { FC } from "react";
import { NAV_ICONS } from "@/lib/icons";
import { kpiValueSizeClass } from "@/lib/utils";

type FinanceKpiTone = "mint" | "red" | "blue" | "amber";
export type KpiSubTone = "up" | "down" | "muted";

export const FinanceKpiCard: FC<{
    label: string;
    value: string;
    iconKey: string;
    iconBg: string;
    iconColor: string;
    tone: FinanceKpiTone;
    sub?: string;
    subTone?: KpiSubTone;
}> = ({ label, value, sub, subTone, iconKey, iconBg, iconColor, tone }) => {
    const Ic = NAV_ICONS[iconKey] ?? NAV_ICONS["/"];
    return (
        <div className={`finance-kpi finance-kpi--${tone}`}>
            <div className="finance-kpi__label">
                <span className="finance-kpi__icon" style={{ background: iconBg, color: iconColor }} aria-hidden>
                    <Ic size={14} />
                </span>
                <span className="finance-kpi__label-text">{label}</span>
            </div>
            <div className={kpiValueSizeClass(value, "finance-kpi__val")}>{value}</div>
            {sub ? (
                <div className="finance-kpi__foot">
                    <span
                        className={[
                            "finance-kpi__delta",
                            subTone === "up"
                                ? "finance-kpi__delta--up"
                                : subTone === "down"
                                  ? "finance-kpi__delta--down"
                                  : "finance-kpi__delta--muted",
                        ].join(" ")}
                    >
                        {sub}
                    </span>
                </div>
            ) : null}
        </div>
    );
};
