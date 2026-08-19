import { useT, useTParams } from "@/lib/i18n";
import { useMemo } from "react";
import { mergeQuickIntoAnamnesisJson, parseAnamnesisV1 } from "@/lib/anamnesis";
import type { ValidationRecord } from "@/lib/chart-validation";
import { formatDateTime } from "@/lib/utils";
import { AnamnesisVisual } from "@/views/components/anamnesis-visual";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { Input, Textarea } from "@/views/components/ui/input";

export type PatientAnamnesisQuickFields = {
    insuranceStatus: string;
    health_insurance: string;
    chronic: string;
    allergiesMed: string;
};

export type PatientDetailAnamTabProps = {
    validationMaster: ValidationRecord | undefined;
    anamEditing: boolean;
    anamQuick: PatientAnamnesisQuickFields;
    anamnesisSigned: boolean;
    anamnesisJson: string;
    onAnamEditingChange: (editing: boolean) => void;
    onAnamQuickChange: (patch: Partial<PatientAnamnesisQuickFields>) => void;
    onAnamnesisSignChange: (signed: boolean) => void;
    onCancelEdit: () => void;
    onSave: () => void | Promise<void>;
};

export function PatientDetailAnamTab({
    validationMaster,
    anamEditing,
    anamQuick,
    anamnesisSigned,
    anamnesisJson,
    onAnamEditingChange,
    onAnamQuickChange,
    onAnamnesisSignChange,
    onCancelEdit,
    onSave,
}: PatientDetailAnamTabProps) {
    const t = useT();
    const tp = useTParams();
    const parsedAnamnesisPreview = useMemo(() => {
        const merged = mergeQuickIntoAnamnesisJson(anamnesisJson, anamQuick);
        return parseAnamnesisV1(merged);
    }, [anamnesisJson, anamQuick]);

    return (
        <div id="panel-anam" role="tabpanel" aria-labelledby="tab-anam">
            <div className="col" style={{ gap: 16 }}>
                <Card className="card-pad">
                    <CardHeader
                        title={t("patient.detail.tab.anam.title")}
                        subtitle={
                            validationMaster
                                ? tp("patient.detail.tab.anam.subtitle_validated", {
                                      datetime: formatDateTime(validationMaster.validatedAt),
                                  })
                                : anamEditing
                                  ? t("patient.detail.tab.anam.subtitle_editing")
                                  : t("patient.detail.tab.anam.subtitle_view")
                        }
                        action={(
                            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                {!anamEditing ? (
                                    <Button size="sm" variant="secondary" type="button" onClick={() => onAnamEditingChange(true)}>
                                        {t("common.edit")}
                                    </Button>
                                ) : (
                                    <>
                                        <Button size="sm" variant="ghost" type="button" onClick={onCancelEdit}>
                                            {t("common.cancel")}
                                        </Button>
                                        <Button size="sm" type="button" onClick={() => void onSave()}>
                                            {t("common.save")}
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                    />
                    <label
                        className="row"
                        style={{
                            marginBottom: 14,
                            gap: 8,
                            alignItems: "center",
                            opacity: anamEditing ? 1 : 0.65,
                            cursor: anamEditing ? "pointer" : "default",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={anamnesisSigned}
                            disabled={!anamEditing}
                            onChange={(e) => onAnamnesisSignChange(e.target.checked)}
                        />
                        <span style={{ fontSize: 13 }}>{t("patient.detail.tab.anam.signature")}</span>
                    </label>
                    <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.45 }}>
                        {t("patient.detail.tab.anam.fields_hint")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
                        <Input
                            id="anam-vs"
                            label={t("patient.detail.tab.anam.field.insurance_status")}
                            value={anamQuick.insuranceStatus}
                            disabled={!anamEditing}
                            onChange={(e) => onAnamQuickChange({ insuranceStatus: e.target.value })}
                            placeholder={t("patient.detail.tab.anam.placeholder.insurance_status")}
                        />
                        <Input
                            id="anam-kk"
                            label={t("patient.detail.tab.anam.field.insurance_fund")}
                            value={anamQuick.health_insurance}
                            disabled={!anamEditing}
                            onChange={(e) => onAnamQuickChange({ health_insurance: e.target.value })}
                        />
                        <Textarea
                            id="anam-chron"
                            label={t("patient.detail.tab.anam.field.chronic")}
                            value={anamQuick.chronic}
                            disabled={!anamEditing}
                            onChange={(e) => onAnamQuickChange({ chronic: e.target.value })}
                            rows={2}
                        />
                        <Textarea
                            id="anam-all"
                            label={t("patient.detail.tab.anam.field.drug_allergies")}
                            value={anamQuick.allergiesMed}
                            disabled={!anamEditing}
                            onChange={(e) => onAnamQuickChange({ allergiesMed: e.target.value })}
                            rows={2}
                        />
                    </div>
                    {parsedAnamnesisPreview ? (
                        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                            <div className="chart-section-eyebrow">{t("patient.detail.anam.overview")}</div>
                            <AnamnesisVisual data={parsedAnamnesisPreview} />
                        </div>
                    ) : (
                        <p style={{ fontSize: 13, color: "var(--fg-3)" }}>
                            {t("patient.detail.tab.anam.no_preview")}
                        </p>
                    )}
                </Card>
            </div>
        </div>
    );
}
