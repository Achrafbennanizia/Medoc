import { useEffect, useMemo, useState } from "react";
import { getOwnProfile, updateOwnProfile, type OwnProfileDto } from "@/systems/practice-host/controllers/personal.controller";
import { errorMessage } from "@/lib/utils";
import { parseRole, type Role } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT, useTParams } from "@/lib/i18n";

const PW_CHANGED_LS = "medoc-settings-pw-changed-at-ms";

function passwordChangedDaysAgo(): number | null {
    try {
        const raw = localStorage.getItem(PW_CHANGED_LS);
        if (!raw) return null;
        const ms = Number.parseInt(raw, 10);
        if (!Number.isFinite(ms)) return null;
        return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
    } catch {
        return null;
    }
}

export type EinstellungenKontoSectionProps = {
    onOpenPasswordDialog: () => void;
    /** Incremented by parent after a successful password change to refresh the last-changed hint. */
    passwordChangedTick?: number;
};

export function EinstellungenKontoSection({ onOpenPasswordDialog, passwordChangedTick = 0 }: EinstellungenKontoSectionProps) {
    const session = useAuthStore((s) => s.session);
    const setSession = useAuthStore((s) => s.setSession);
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();

    const [ownProfile, setOwnProfile] = useState<OwnProfileDto | null>(null);
    const [ownProfileLoadError, setOwnProfileLoadError] = useState<string | null>(null);
    const [kontoProfileLoading, setKontoProfileLoading] = useState(false);
    const [editKontoName, setEditKontoName] = useState(false);
    const [editKontoEmail, setEditKontoEmail] = useState(false);
    const [editKontoTelefon, setEditKontoTelefon] = useState(false);
    const [draftKontoName, setDraftKontoName] = useState("");
    const [draftKontoEmail, setDraftKontoEmail] = useState("");
    const [draftKontoTelefon, setDraftKontoTelefon] = useState("");
    const [kontoSaveNameBusy, setKontoSaveNameBusy] = useState(false);
    const [kontoSaveEmailBusy, setKontoSaveEmailBusy] = useState(false);
    const [kontoSaveTelefonBusy, setKontoSaveTelefonBusy] = useState(false);

    useEffect(() => {
        if (!session?.user_id) return;
        let cancelled = false;
        setOwnProfileLoadError(null);
        setKontoProfileLoading(true);
        void getOwnProfile()
            .then((p) => {
                if (cancelled) return;
                setOwnProfile(p);
                setDraftKontoName(p.name);
                setDraftKontoEmail(p.email);
                setDraftKontoTelefon(p.telefon ?? "");
                setEditKontoName(false);
                setEditKontoEmail(false);
                setEditKontoTelefon(false);
            })
            .catch((e) => {
                if (!cancelled) setOwnProfileLoadError(errorMessage(e));
            })
            .finally(() => {
                if (!cancelled) setKontoProfileLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [session?.user_id]);

    function applyOwnProfileToStores(profile: OwnProfileDto) {
        setOwnProfile(profile);
        const cur = useAuthStore.getState().session;
        if (cur) {
            setSession({
                ...cur,
                name: profile.name,
                email: profile.email,
                rolle: profile.rolle,
            });
        }
    }

    async function saveKontoName() {
        const name = draftKontoName.trim();
        if (!name) {
            toast(t("settings.konto.name_required"), "error");
            return;
        }
        setKontoSaveNameBusy(true);
        try {
            const p = await updateOwnProfile({ name });
            applyOwnProfileToStores(p);
            toast(t("settings.konto.name_saved"), "success");
            setEditKontoName(false);
        } catch (e) {
            toast(tp("settings.praef.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setKontoSaveNameBusy(false);
        }
    }

    async function saveKontoEmail() {
        const email = draftKontoEmail.trim();
        if (!email) {
            toast(t("settings.konto.email_required"), "error");
            return;
        }
        setKontoSaveEmailBusy(true);
        try {
            const p = await updateOwnProfile({ email });
            applyOwnProfileToStores(p);
            toast(t("settings.konto.email_saved"), "success");
            setEditKontoEmail(false);
        } catch (e) {
            toast(tp("settings.praef.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setKontoSaveEmailBusy(false);
        }
    }

    async function saveKontoTelefon() {
        setKontoSaveTelefonBusy(true);
        try {
            const p = await updateOwnProfile({ telefon: draftKontoTelefon.trim() });
            applyOwnProfileToStores(p);
            toast(t("settings.konto.phone_saved"), "success");
            setEditKontoTelefon(false);
        } catch (e) {
            toast(tp("settings.praef.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setKontoSaveTelefonBusy(false);
        }
    }

    const rolePresent = useMemo(() => {
        const r = parseRole(session?.rolle);
        const map: Record<Role, { line: string; badge: string }> = {
            ARZT: { line: t("settings.konto.role_arzt_line"), badge: t("settings.konto.role_arzt_badge") },
            REZEPTION: { line: t("settings.konto.role_rezeption_line"), badge: t("settings.konto.role_rezeption_badge") },
        };
        if (r && map[r]) return map[r];
        return { line: session?.rolle ?? "—", badge: "—" };
    }, [session?.rolle, t]);

    const pwDays = useMemo(() => {
        void passwordChangedTick;
        return passwordChangedDaysAgo();
    }, [passwordChangedTick]);

    const profileSub = kontoProfileLoading
        ? t("settings.konto.profile_loading")
        : ownProfileLoadError
          ? tp("settings.konto.profile_load_failed", { message: ownProfileLoadError })
          : `${ownProfile?.name ?? session?.name ?? "—"}${ownProfile?.email || session?.email ? ` · ${ownProfile?.email ?? session?.email}` : ""}`;

    const passwordHint =
        pwDays != null
            ? pwDays === 1
                ? tp("settings.konto.password_days_one", { days: pwDays })
                : tp("settings.konto.password_days_many", { days: pwDays })
            : t("settings.konto.password_unknown");

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.konto.title")}</div>
                    <div className="card-sub">{profileSub}</div>
                </div>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>{t("common.name")}</b>
                    <div className="settings-row-muted">{ownProfile?.name ?? session?.name ?? "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editKontoName ? (
                        <>
                            <Input
                                value={draftKontoName}
                                onChange={(e) => setDraftKontoName(e.target.value)}
                                aria-label={t("common.name")}
                                autoComplete="name"
                                disabled={kontoProfileLoading}
                                style={{ minWidth: 160, maxWidth: 280 }}
                            />
                            <Button
                                type="button"
                                loading={kontoSaveNameBusy}
                                disabled={kontoSaveNameBusy || kontoProfileLoading}
                                onClick={() => void saveKontoName()}
                            >
                                {t("common.save")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={kontoSaveNameBusy}
                                onClick={() => {
                                    setDraftKontoName(ownProfile?.name ?? session?.name ?? "");
                                    setEditKontoName(false);
                                }}
                            >
                                {t("common.cancel")}
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={kontoProfileLoading || Boolean(ownProfileLoadError)}
                            onClick={() => {
                                setDraftKontoName(ownProfile?.name ?? session?.name ?? "");
                                setEditKontoName(true);
                            }}
                        >
                            {t("common.edit")}
                        </Button>
                    )}
                </div>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>{t("common.email")}</b>
                    <div className="settings-row-muted">{ownProfile?.email ?? session?.email ?? "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editKontoEmail ? (
                        <>
                            <Input
                                type="email"
                                value={draftKontoEmail}
                                onChange={(e) => setDraftKontoEmail(e.target.value)}
                                aria-label={t("common.email")}
                                autoComplete="email"
                                disabled={kontoProfileLoading}
                                style={{ minWidth: 160, maxWidth: 280 }}
                            />
                            <Button
                                type="button"
                                loading={kontoSaveEmailBusy}
                                disabled={kontoSaveEmailBusy || kontoProfileLoading}
                                onClick={() => void saveKontoEmail()}
                            >
                                {t("common.save")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={kontoSaveEmailBusy}
                                onClick={() => {
                                    setDraftKontoEmail(ownProfile?.email ?? session?.email ?? "");
                                    setEditKontoEmail(false);
                                }}
                            >
                                {t("common.cancel")}
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={kontoProfileLoading || Boolean(ownProfileLoadError)}
                            onClick={() => {
                                setDraftKontoEmail(ownProfile?.email ?? session?.email ?? "");
                                setEditKontoEmail(true);
                            }}
                        >
                            {t("common.edit")}
                        </Button>
                    )}
                </div>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>{t("common.phone")}</b>
                    <div className="settings-row-muted">{(ownProfile?.telefon ?? "").trim() || "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editKontoTelefon ? (
                        <>
                            <Input
                                type="tel"
                                value={draftKontoTelefon}
                                onChange={(e) => setDraftKontoTelefon(e.target.value)}
                                aria-label={t("common.phone")}
                                autoComplete="tel"
                                disabled={kontoProfileLoading}
                                style={{ minWidth: 160, maxWidth: 280 }}
                            />
                            <Button
                                type="button"
                                loading={kontoSaveTelefonBusy}
                                disabled={kontoSaveTelefonBusy || kontoProfileLoading}
                                onClick={() => void saveKontoTelefon()}
                            >
                                {t("common.save")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={kontoSaveTelefonBusy}
                                onClick={() => {
                                    setDraftKontoTelefon(ownProfile?.telefon ?? "");
                                    setEditKontoTelefon(false);
                                }}
                            >
                                {t("common.cancel")}
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={kontoProfileLoading || Boolean(ownProfileLoadError)}
                            onClick={() => {
                                setDraftKontoTelefon(ownProfile?.telefon ?? "");
                                setEditKontoTelefon(true);
                            }}
                        >
                            {t("common.edit")}
                        </Button>
                    )}
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("common.role")}</b>
                    <div className="settings-row-muted">{rolePresent.line}</div>
                </div>
                <span className="settings-pill-blue">{rolePresent.badge}</span>
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("common.password")}</b>
                    <div className="settings-row-muted">{passwordHint}</div>
                </div>
                <Button variant="secondary" type="button" onClick={onOpenPasswordDialog}>
                    {t("common.change")}
                </Button>
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.konto.logout_title")}</b>
                    <div className="settings-row-muted">{t("settings.konto.logout_hint")}</div>
                </div>
                <Button type="button" variant="secondary" onClick={() => window.dispatchEvent(new Event("medoc-request-logout"))}>
                    {t("settings.konto.logout_button")}
                </Button>
            </div>
        </section>
    );
}
