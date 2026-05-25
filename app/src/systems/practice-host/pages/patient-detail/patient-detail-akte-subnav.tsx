import { Fragment } from "react";
import { itemValidationKey, type ValidationRecord, type ValidationState } from "@/lib/akte-validation";
import type { AkteAnlage } from "@/lib/akte-anlagen";
import { patientDetailTabBlocked, type PatientDetailAkteTab } from "@/lib/patient-detail-utils";
import type { Zahlung } from "@/models/types";

type AkteTabDef = { id: PatientDetailAkteTab; label: string; needsClinical?: boolean };

const AKTE_TABS: AkteTabDef[] = [
    { id: "stamm", label: "Stammdaten" },
    { id: "anam", label: "Anamnese", needsClinical: true },
    { id: "unter", label: "Untersuchungen", needsClinical: true },
    { id: "behand", label: "Behandlungen", needsClinical: true },
    { id: "rezept", label: "Rezepte & Atteste" },
    { id: "anlage", label: "Extra Anlagen" },
    { id: "zahl", label: "Kundenleistungen" },
];

const AKTE_TAB_SECTIONS: { heading: string; tabIds: PatientDetailAkteTab[] }[] = [
    { heading: "Verwaltung", tabIds: ["stamm", "anam"] },
    { heading: "Klinik", tabIds: ["unter", "behand", "rezept"] },
    { heading: "Dokumente & Finanzen", tabIds: ["anlage", "zahl"] },
];

export type PatientDetailAkteSubnavProps = {
    activeTab: PatientDetailAkteTab;
    canViewClinical: boolean;
    validation: ValidationState;
    anlagen: AkteAnlage[];
    zahlungen: Zahlung[];
    itemValidation: Partial<Record<string, ValidationRecord>>;
    onSelectTab: (tab: PatientDetailAkteTab) => void;
    onBlockedClinicalTab: () => void;
};

export function PatientDetailAkteSubnav({
    activeTab,
    canViewClinical,
    validation,
    anlagen,
    zahlungen,
    itemValidation,
    onSelectTab,
    onBlockedClinicalTab,
}: PatientDetailAkteSubnavProps) {
    const anlPending = anlagen.filter((a) => !itemValidation[itemValidationKey("anl", a.id)]).length;
    const zahlPending = zahlungen.filter((z) => !itemValidation[itemValidationKey("zahl", z.id)]).length;

    return (
        <nav className="akte-subnav" role="tablist" aria-label="Patientenakte">
            {AKTE_TAB_SECTIONS.map((section, si) => (
                <Fragment key={section.heading}>
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
                        {section.heading}
                    </div>
                    {section.tabIds.map((tabId) => {
                        const tab = AKTE_TABS.find((t) => t.id === tabId);
                        if (!tab) return null;
                        const blocked = patientDetailTabBlocked(tab.id, canViewClinical);
                        let badge: { tone: "warn" | "ok"; text: string } | null = null;
                        if (tab.id === "stamm" || tab.id === "anam") {
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
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                id={`tab-${tab.id}`}
                                aria-selected={activeTab === tab.id}
                                aria-controls={`panel-${tab.id}`}
                                disabled={blocked}
                                className={`${activeTab === tab.id ? "active" : ""}`}
                                title={
                                    tab.id === "anam"
                                        ? "Gilt gemeinsam mit Stammdaten (ein gemeinsamer Validierungsschritt)"
                                        : undefined
                                }
                                onClick={() => {
                                    if (blocked) {
                                        onBlockedClinicalTab();
                                        return;
                                    }
                                    onSelectTab(tab.id);
                                }}
                            >
                                <span>{tab.label}</span>
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
