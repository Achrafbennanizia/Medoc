import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import { listPhysicians, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";

/** Same key as `DOCTOR_SIGNATURES_KV_KEY` in medoc-core `documents/issue.rs`. */
const KEY = "documents.doctor_signatures.v1" as const;

type Entry = { title?: string; professionalId?: string };
type Signatures = Record<string, Entry>;

function parse(raw: string | null): Signatures {
    try {
        const v = raw ? JSON.parse(raw) : {};
        return v && typeof v === "object" && !Array.isArray(v) ? (v as Signatures) : {};
    } catch {
        return {};
    }
}

/**
 * Group: title and professional id of each dentist, printed in the signature block of the
 * prescriptions and certificates they sign (editions-plan §5.1). The practice clinician above
 * keeps the practice's own fields.
 */
export function SettingsDoctorSignatures({ idLabel }: { idLabel: string }) {
    const t = useT();
    const [doctors, setDoctors] = useState<PhysicianSummary[]>([]);
    const [saved, setSaved] = useState<Signatures>({});
    const [draft, setDraft] = useState<Signatures | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let alive = true;
        void Promise.all([listPhysicians(), getAppKv(KEY)])
            .then(([list, raw]) => {
                if (!alive) return;
                setDoctors(list);
                setSaved(parse(raw));
            })
            .catch(() => alive && setError(t("settings.practice.doctor_signatures_load_failed")));
        return () => {
            alive = false;
        };
    }, [t]);

    if (doctors.length < 2) return null;

    const view = draft ?? saved;
    const set = (id: string, patch: Entry) => setDraft((d) => ({ ...(d ?? saved), [id]: { ...(d ?? saved)[id], ...patch } }));

    async function save() {
        if (!draft) return;
        try {
            await setAppKv(KEY, JSON.stringify(draft));
            setSaved(draft);
            setDraft(null);
            setError("");
        } catch {
            setError(t("settings.practice.doctor_signatures_save_failed"));
        }
    }

    return (
        <>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>{t("settings.practice.doctor_signatures_title")}</b>
                    <div className="settings-row-muted">{t("settings.practice.doctor_signatures_hint")}</div>
                </div>
                <div className="row" style={{ gap: "var(--space-2)" }}>
                    {draft ? (
                        <>
                            <Button type="button" onClick={() => void save()}>
                                {t("common.save")}
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                                {t("common.cancel")}
                            </Button>
                        </>
                    ) : (
                        <Button type="button" variant="secondary" onClick={() => setDraft(saved)}>
                            {t("common.edit")}
                        </Button>
                    )}
                </div>
            </div>
            {error ? (
                <p className="settings-row-muted" role="alert">
                    {error}
                </p>
            ) : null}
            <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                {doctors.map((d) => (
                    <div key={d.id} className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ alignItems: "end", marginBottom: "var(--space-3)" }}>
                        <b>{d.name}</b>
                        <Input
                            id={`doc-sig-title-${d.id}`}
                            label={t("settings.practice.billing_professional_title")}
                            value={view[d.id]?.title ?? ""}
                            disabled={!draft}
                            onChange={(e) => set(d.id, { title: e.target.value })}
                        />
                        <Input
                            id={`doc-sig-id-${d.id}`}
                            label={idLabel}
                            value={view[d.id]?.professionalId ?? ""}
                            disabled={!draft}
                            onChange={(e) => set(d.id, { professionalId: e.target.value })}
                        />
                    </div>
                ))}
            </div>
        </>
    );
}
