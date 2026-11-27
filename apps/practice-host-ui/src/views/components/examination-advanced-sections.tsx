/** "More findings" part of the examination form: chief complaint, extra/intraoral, PSI, function, imaging (split from `examination-composer.tsx`). */
import type { Dispatch, SetStateAction } from "react";
import { Input, Select, Textarea } from "./ui/input";
import { useT, useTParams } from "@/lib/i18n";
import type { ExaminationV1 } from "@/lib/examination";

export function ExamAdvancedSections({
    data,
    setData,
    locked,
}: {
    data: ExaminationV1;
    setData: Dispatch<SetStateAction<ExaminationV1>>;
    locked: boolean;
}) {
    const t = useT();
    const tp = useTParams();
    const upd = <K extends keyof ExaminationV1>(key: K, val: ExaminationV1[K]) => setData((prev) => ({ ...prev, [key]: val }));
    const nested = <S extends "extraoral" | "intraoral" | "function" | "imaging">(section: S, field: keyof ExaminationV1[S], value: string) =>
        setData((prev: ExaminationV1) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
    const advancedFilled =
        !!(data.chiefComplaint || data.painVas || data.painLocation || data.bopPercent || data.plaqueIndex || data.hygieneScore || data.plan) ||
        [data.extraoral, data.intraoral, data.psi, data.function, data.imaging].some((o) => Object.values(o).some((v) => v.trim()));
    const psiOptions = [
        { value: "", label: t("examination.composer.psi_empty") },
        ...["0", "1", "2", "3", "4"].map((v) => ({ value: v, label: t(`examination.composer.psi_${v}`) })),
        { value: "*", label: t("examination.composer.psi_star") },
    ];
    const field = (id: string, label: string, value: string, onChange: (v: string) => void, placeholder?: string) => (
        <Input id={id} label={label} value={value} placeholder={placeholder} disabled={locked} onChange={(e) => onChange(e.target.value)} />
    );

    return (
        <details className="exam-advanced" open={advancedFilled || undefined}>
            <summary>{t("examination.composer.advanced_title")}</summary>
            <section className="exam-advanced__section">
                <h4>{t("examination.composer.section_haupt")}</h4>
                <Textarea id="u-chief" label={t("examination.composer.chief")} value={data.chiefComplaint} rows={2} placeholder={t("examination.composer.chief_ph")} disabled={locked} onChange={(e) => upd("chiefComplaint", e.target.value)} />
                <div className="exam-advanced__grid">
                    {field("u-vas", t("examination.composer.pain_vas"), data.painVas, (v) => upd("painVas", v), t("examination.composer.pain_vas_ph"))}
                    {field("u-pain-loc", t("examination.composer.pain_location"), data.painLocation, (v) => upd("painLocation", v), t("examination.composer.pain_location_ph"))}
                </div>
            </section>
            <section className="exam-advanced__section">
                <h4>{t("examination.composer.section_extra")}</h4>
                <div className="exam-advanced__grid">
                    {field("u-tmj", t("examination.composer.tmj"), data.extraoral.tmj, (v) => nested("extraoral", "tmj", v), t("examination.composer.tmj_ph"))}
                    {field("u-lymph", t("examination.composer.lymph"), data.extraoral.lymphNodes, (v) => nested("extraoral", "lymphNodes", v))}
                    {field("u-asym", t("examination.composer.asymmetry"), data.extraoral.asymmetry, (v) => nested("extraoral", "asymmetry", v))}
                    {field("u-muscles", t("examination.composer.muscles"), data.extraoral.muscles, (v) => nested("extraoral", "muscles", v))}
                </div>
            </section>
            <section className="exam-advanced__section">
                <h4>{t("examination.composer.section_intra")}</h4>
                <div className="exam-advanced__grid">
                    {field("u-mucosa", t("examination.composer.mucosa"), data.intraoral.mucosa, (v) => nested("intraoral", "mucosa", v))}
                    {field("u-tongue", t("examination.composer.tongue"), data.intraoral.tongue, (v) => nested("intraoral", "tongue", v))}
                    {field("u-gingiva", t("examination.composer.gingiva"), data.intraoral.gingiva, (v) => nested("intraoral", "gingiva", v))}
                    {field("u-saliva", t("examination.composer.salivary"), data.intraoral.salivary, (v) => nested("intraoral", "salivary", v))}
                </div>
            </section>
            <section className="exam-advanced__section">
                <h4>{t("examination.composer.section_paro")}</h4>
                <p className="exam-advanced__hint">{t("examination.composer.psi_hint")}</p>
                <div className="exam-advanced__psi">
                    {(["s1", "s2", "s3", "s4", "s5", "s6"] as const).map((s, i) => (
                        <Select
                            key={s}
                            label={tp("examination.composer.sextant", { n: i + 1 })}
                            value={data.psi[s]}
                            options={psiOptions}
                            disabled={locked}
                            onChange={(e) => setData((prev) => ({ ...prev, psi: { ...prev.psi, [s]: e.target.value } }))}
                        />
                    ))}
                </div>
                <div className="exam-advanced__grid exam-advanced__grid--3">
                    {field("u-bop", t("examination.composer.bop"), data.bopPercent, (v) => upd("bopPercent", v), t("examination.composer.bop_ph"))}
                    {field("u-pi", t("examination.composer.plaque"), data.plaqueIndex, (v) => upd("plaqueIndex", v), t("examination.composer.plaque_ph"))}
                    {field("u-hyg", t("examination.composer.hygiene"), data.hygieneScore, (v) => upd("hygieneScore", v), t("examination.composer.hygiene_ph"))}
                </div>
            </section>
            <section className="exam-advanced__section">
                <h4>{t("examination.composer.section_funk")}</h4>
                <div className="exam-advanced__grid">
                    {field("u-cmd", t("examination.composer.cmd"), data.function.cmd, (v) => nested("function", "cmd", v))}
                    {field("u-brux", t("examination.composer.bruxism"), data.function.bruxism, (v) => nested("function", "bruxism", v))}
                    {field("u-splint", t("examination.composer.splint"), data.function.splint, (v) => nested("function", "splint", v))}
                    {field("u-fn-notes", t("examination.composer.function_notes"), data.function.notes, (v) => nested("function", "notes", v))}
                </div>
            </section>
            <section className="exam-advanced__section">
                <h4>{t("examination.composer.section_rx")}</h4>
                {field("u-img-ordered", t("examination.composer.imaging_ordered"), data.imaging.ordered, (v) => nested("imaging", "ordered", v), t("examination.composer.imaging_ordered_ph"))}
                <Textarea id="u-img-findings" label={t("examination.composer.imaging_note")} value={data.imaging.findings} rows={2} disabled={locked} onChange={(e) => nested("imaging", "findings", e.target.value)} />
            </section>
        </details>
    );
}
