import { Fragment } from "react";
import { itemValidationKey, type ValidationRecord, type ValidationState } from "@/lib/chart-validation";
import type { ChartAttachment } from "@/lib/chart-attachments";
import { patientDetailTabVisible, type PatientDetailChartTab } from "@/lib/patient-detail-utils";
import { useT } from "@/lib/i18n";
import type { Payment } from "@/models/types";

type ChartTabDef = { id: PatientDetailChartTab; labelKey: string; needsClinical?: boolean };

const CHART_TABS: ChartTabDef[] = [
    { id: "anamnesis", labelKey: "patient.detail.subnav.tab.anam", needsClinical: true },
    { id: "examination", labelKey: "patient.detail.subnav.tab.unter", needsClinical: true },
    { id: "treatment", labelKey: "patient.detail.subnav.tab.treatment", needsClinical: true },
    { id: "prescription", labelKey: "patient.detail.subnav.tab.prescription" },
    { id: "attachment", labelKey: "patient.detail.subnav.tab.attachment" },
    { id: "payment", labelKey: "patient.detail.subnav.tab.payment" },
];

const CHART_TAB_SECTIONS: { headingKey: string; tabIds: PatientDetailChartTab[] }[] = [
    { headingKey: "patient.detail.subnav.section.administration", tabIds: ["anamnesis"] },
    { headingKey: "patient.detail.subnav.section.clinical", tabIds: ["examination", "treatment", "prescription"] },
    { headingKey: "patient.detail.subnav.section.docs_finance", tabIds: ["attachment", "payment"] },
];

export type PatientDetailChartSubnavProps = {
    activeTab: PatientDetailChartTab;
    canViewClinical: boolean;
    validation: ValidationState;
    attachments: ChartAttachment[];
    payments: Payment[];
    itemValidation: Partial<Record<string, ValidationRecord>>;
    onSelectTab: (tab: PatientDetailChartTab) => void;
};

export function PatientDetailChartSubnav({
    activeTab,
    canViewClinical,
    validation,
    attachments,
    payments,
    itemValidation,
    onSelectTab,
}: PatientDetailChartSubnavProps) {
    const t = useT();
    const anlPending = attachments.filter((a) => !itemValidation[itemValidationKey("anl", a.id)]).length;
    const paymentPending = payments.filter((z) => !itemValidation[itemValidationKey("payment", z.id)]).length;

    const visibleSections = CHART_TAB_SECTIONS.map((section) => ({
        ...section,
        tabIds: section.tabIds.filter((tabId) => {
            const tab = CHART_TABS.find((t) => t.id === tabId);
            return tab != null && patientDetailTabVisible(tab.id, canViewClinical);
        }),
    })).filter((section) => section.tabIds.length > 0);

    return (
        <nav className="chart-subnav" role="tablist" aria-label={t("patient.detail.subnav.aria")}>
            {visibleSections.map((section, si) => (
                <Fragment key={section.headingKey}>
                    <div
                        className="chart-subnav-group-heading"
                        style={{
                            gridColumn: "1 / -1",
                            padding: si === 0 ? "0 0 4px" : "14px 0 4px",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--fg-4)",
                        }}
                    >
                        {t(section.headingKey)}
                    </div>
                    {section.tabIds.map((tabId) => {
                        const tab = CHART_TABS.find((t) => t.id === tabId);
                        if (!tab) return null;
                        let badge: { tone: "warn" | "ok"; text: string } | null = null;
                        if (canViewClinical) {
                            if (tab.id === "anamnesis") {
                                if (!validation.master) badge = { tone: "warn", text: "!" };
                                else badge = { tone: "ok", text: "✓" };
                            } else if (tab.id === "attachment") {
                                if (attachments.length === 0) badge = null;
                                else if (anlPending === 0) badge = { tone: "ok", text: "✓" };
                                else badge = { tone: "warn", text: anlPending > 1 ? String(anlPending) : "!" };
                            } else if (tab.id === "payment") {
                                if (payments.length === 0) badge = null;
                                else if (paymentPending === 0) badge = { tone: "ok", text: "✓" };
                                else badge = { tone: "warn", text: paymentPending > 1 ? String(paymentPending) : "!" };
                            }
                        }
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                id={`tab-${tab.id}`}
                                aria-selected={activeTab === tab.id}
                                aria-controls={`panel-${tab.id}`}
                                className={`${activeTab === tab.id ? "active" : ""}`}
                                title={tab.id === "anamnesis" ? t("patient.detail.subnav.anam_title") : undefined}
                                onClick={() => onSelectTab(tab.id)}
                            >
                                <span>{t(tab.labelKey)}</span>
                                {badge ? (
                                    <span className={`tab-badge ${badge.tone}`} aria-hidden>
                                        {badge.text}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </Fragment>
            ))}
        </nav>
    );
}
