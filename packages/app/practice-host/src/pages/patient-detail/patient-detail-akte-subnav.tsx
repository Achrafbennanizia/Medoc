import { Fragment } from "react";
import { itemValidationKey, type ValidationRecord, type ValidationState } from "@/lib/akte-validation";
import type { AkteAnlage } from "@/lib/akte-anlagen";
import { patientDetailTabVisible, type PatientDetailAkteTab } from "@/lib/patient-detail-utils";
import { useT } from "@/lib/i18n";
import type { Zahlung } from "@/models/types";

type AkteTabDef = { id: PatientDetailAkteTab; labelKey: string; needsClinical?: boolean };

const AKTE_TABS: AkteTabDef[] = [
    { id: "anam", labelKey: "patient.detail.subnav.tab.anam", needsClinical: true },
    { id: "unter", labelKey: "patient.detail.subnav.tab.unter", needsClinical: true },
    { id: "behand", labelKey: "patient.detail.subnav.tab.behand", needsClinical: true },
    { id: "rezept", labelKey: "patient.detail.subnav.tab.rezept" },
    { id: "anlage", labelKey: "patient.detail.subnav.tab.anlage" },
    { id: "zahl", labelKey: "patient.detail.subnav.tab.zahl" },
];

const AKTE_TAB_SECTIONS: { headingKey: string; tabIds: PatientDetailAkteTab[] }[] = [
    { headingKey: "patient.detail.subnav.section.administration", tabIds: ["anam"] },
    { headingKey: "patient.detail.subnav.section.clinical", tabIds: ["unter", "behand", "rezept"] },
    { headingKey: "patient.detail.subnav.section.docs_finance", tabIds: ["anlage", "zahl"] },
];

export type PatientDetailAkteSubnavProps = {
    activeTab: PatientDetailAkteTab;
    canViewClinical: boolean;
    validation: ValidationState;
    anlagen: AkteAnlage[];
    zahlungen: Zahlung[];
    itemValidation: Partial<Record<string, ValidationRecord>>;
    onSelectTab: (tab: PatientDetailAkteTab) => void;
};

export function PatientDetailAkteSubnav({
    activeTab,
    canViewClinical,
    validation,
    anlagen,
    zahlungen,
    itemValidation,
    onSelectTab,
}: PatientDetailAkteSubnavProps) {
    const t = useT();
    const anlPending = anlagen.filter((a) => !itemValidation[itemValidationKey("anl", a.id)]).length;
    const zahlPending = zahlungen.filter((z) => !itemValidation[itemValidationKey("zahl", z.id)]).length;

    const visibleSections = AKTE_TAB_SECTIONS.map((section) => ({
        ...section,
        tabIds: section.tabIds.filter((tabId) => {
            const tab = AKTE_TABS.find((t) => t.id === tabId);
            return tab != null && patientDetailTabVisible(tab.id, canViewClinical);
        }),
    })).filter((section) => section.tabIds.length > 0);

    return (
        <nav className="akte-subnav" role="tablist" aria-label={t("patient.detail.subnav.aria")}>
            {visibleSections.map((section, si) => (
                <Fragment key={section.headingKey}>
                    <div
                        className="akte-subnav-group-heading"
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
                        const tab = AKTE_TABS.find((t) => t.id === tabId);
                        if (!tab) return null;
                        let badge: { tone: "warn" | "ok"; text: string } | null = null;
                        if (canViewClinical) {
                            if (tab.id === "anam") {
                                if (!validation.stamm) badge = { tone: "warn", text: "!" };
                                else badge = { tone: "ok", text: "✓" };
                            } else if (tab.id === "anlage") {
                                if (anlagen.length === 0) badge = null;
                                else if (anlPending === 0) badge = { tone: "ok", text: "✓" };
                                else badge = { tone: "warn", text: anlPending > 1 ? String(anlPending) : "!" };
                            } else if (tab.id === "zahl") {
                                if (zahlungen.length === 0) badge = null;
                                else if (zahlPending === 0) badge = { tone: "ok", text: "✓" };
                                else badge = { tone: "warn", text: zahlPending > 1 ? String(zahlPending) : "!" };
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
                                title={tab.id === "anam" ? t("patient.detail.subnav.anam_title") : undefined}
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
