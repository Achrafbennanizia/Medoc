import { useEffect, useMemo, useState } from "react";
import { getOwnProfile, updateOwnProfile, type OwnProfileDto } from "@/systems/practice-host/controllers/staff.controller";
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

export type SettingsAccountSectionProps = {
    onOpenPasswordDialog: () => void;
    /** Incremented by parent after a successful password change to refresh the last-changed hint. */
    passwordChangedTick?: number;
};

export function SettingsAccountSection({ onOpenPasswordDialog, passwordChangedTick = 0 }: SettingsAccountSectionProps) {
    const session = useAuthStore((s) => s.session);
    const setSession = useAuthStore((s) => s.setSession);
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();

    const [ownProfile, setOwnProfile] = useState<OwnProfileDto | null>(null);
    const [ownProfileLoadError, setOwnProfileLoadError] = useState<string | null>(null);
    const [accountProfileLoading, setAccountProfileLoading] = useState(false);
    const [editKontoName, setEditKontoName] = useState(false);
    const [editKontoEmail, setEditKontoEmail] = useState(false);
    const [editKontoPhone, setEditKontoPhone] = useState(false);
    const [draftKontoName, setDraftKontoName] = useState("");
    const [draftKontoEmail, setDraftKontoEmail] = useState("");
    const [draftKontoPhone, setDraftKontoPhone] = useState("");
    const [accountSaveNameBusy, setAccountSaveNameBusy] = useState(false);
    const [accountSaveEmailBusy, setAccountSaveEmailBusy] = useState(false);
    const [accountSavePhoneBusy, setAccountSavePhoneBusy] = useState(false);

    useEffect(() => {
        if (!session?.user_id) return;
        let cancelled = false;
        setOwnProfileLoadError(null);
        setAccountProfileLoading(true);
        void getOwnProfile()
            .then((p) => {
                if (cancelled) return;
                setOwnProfile(p);
                setDraftKontoName(p.name);
                setDraftKontoEmail(p.email);
                setDraftKontoPhone(p.phone ?? "");
                setEditKontoName(false);
                setEditKontoEmail(false);
                setEditKontoPhone(false);
            })
            .catch((e) => {
                if (!cancelled) setOwnProfileLoadError(errorMessage(e));
            })
            .finally(() => {
                if (!cancelled) setAccountProfileLoading(false);
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
                role: profile.role,
            });
        }
    }

    async function saveKontoName() {
        const name = draftKontoName.trim();
        if (!name) {
            toast(t("settings.account.name_required"), "error");
            return;
        }
        setAccountSaveNameBusy(true);
        try {
            const p = await updateOwnProfile({ name });
            applyOwnProfileToStores(p);
            toast(t("settings.account.name_saved"), "success");
            setEditKontoName(false);
        } catch (e) {
            toast(tp("settings.prefs.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setAccountSaveNameBusy(false);
        }
    }

    async function saveKontoEmail() {
        const email = draftKontoEmail.trim();
        if (!email) {
            toast(t("settings.account.email_required"), "error");
            return;
        }
        setAccountSaveEmailBusy(true);
        try {
            const p = await updateOwnProfile({ email });
            applyOwnProfileToStores(p);
            toast(t("settings.account.email_saved"), "success");
            setEditKontoEmail(false);
        } catch (e) {
            toast(tp("settings.prefs.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setAccountSaveEmailBusy(false);
        }
    }

    async function saveKontoPhone() {
        setAccountSavePhoneBusy(true);
        try {
            const p = await updateOwnProfile({ phone: draftKontoPhone.trim() });
            applyOwnProfileToStores(p);
            toast(t("settings.account.phone_saved"), "success");
            setEditKontoPhone(false);
        } catch (e) {
            toast(tp("settings.prefs.save_failed", { message: errorMessage(e) }), "error");
        } finally {
            setAccountSavePhoneBusy(false);
        }
    }

    const rolePresent = useMemo(() => {
        const r = parseRole(session?.role);
        const map: Record<Role, { line: string; badge: string }> = {
            PHYSICIAN: { line: t("settings.account.role_physician_line"), badge: t("settings.account.role_physician_badge") },
            RECEPTION: { line: t("settings.account.role_reception_line"), badge: t("settings.account.role_reception_badge") },
        };
        if (r && map[r]) return map[r];
        return { line: session?.role ?? "—", badge: "—" };
    }, [session?.role, t]);

    const pwDays = useMemo(() => {
        void passwordChangedTick;
        return passwordChangedDaysAgo();
    }, [passwordChangedTick]);

    const profileSub = accountProfileLoading
        ? t("settings.account.profile_loading")
        : ownProfileLoadError
          ? tp("settings.account.profile_load_failed", { message: ownProfileLoadError })
          : `${ownProfile?.name ?? session?.name ?? "—"}${ownProfile?.email || session?.email ? ` · ${ownProfile?.email ?? session?.email}` : ""}`;

    const passwordHint =
        pwDays != null
            ? pwDays === 1
                ? tp("settings.account.password_days_one", { days: pwDays })
                : tp("settings.account.password_days_many", { days: pwDays })
            : t("settings.account.password_unknown");

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.account.title")}</div>
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
                                disabled={accountProfileLoading}
                                style={{ minWidth: 160, maxWidth: 280 }}
                            />
                            <Button
                                type="button"
                                loading={accountSaveNameBusy}
                                disabled={accountSaveNameBusy || accountProfileLoading}
                                onClick={() => void saveKontoName()}
                            >
                                {t("common.save")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={accountSaveNameBusy}
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
                            disabled={accountProfileLoading || Boolean(ownProfileLoadError)}
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
                                disabled={accountProfileLoading}
                                style={{ minWidth: 160, maxWidth: 280 }}
                            />
                            <Button
                                type="button"
                                loading={accountSaveEmailBusy}
                                disabled={accountSaveEmailBusy || accountProfileLoading}
                                onClick={() => void saveKontoEmail()}
                            >
                                {t("common.save")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={accountSaveEmailBusy}
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
                            disabled={accountProfileLoading || Boolean(ownProfileLoadError)}
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
                    <div className="settings-row-muted">{(ownProfile?.phone ?? "").trim() || "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editKontoPhone ? (
                        <>
                            <Input
                                type="tel"
                                value={draftKontoPhone}
                                onChange={(e) => setDraftKontoPhone(e.target.value)}
                                aria-label={t("common.phone")}
                                autoComplete="tel"
                                disabled={accountProfileLoading}
                                style={{ minWidth: 160, maxWidth: 280 }}
                            />
                            <Button
                                type="button"
                                loading={accountSavePhoneBusy}
                                disabled={accountSavePhoneBusy || accountProfileLoading}
                                onClick={() => void saveKontoPhone()}
                            >
                                {t("common.save")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={accountSavePhoneBusy}
                                onClick={() => {
                                    setDraftKontoPhone(ownProfile?.phone ?? "");
                                    setEditKontoPhone(false);
                                }}
                            >
                                {t("common.cancel")}
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={accountProfileLoading || Boolean(ownProfileLoadError)}
                            onClick={() => {
                                setDraftKontoPhone(ownProfile?.phone ?? "");
                                setEditKontoPhone(true);
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
                    <b>{t("settings.account.logout_title")}</b>
                    <div className="settings-row-muted">{t("settings.account.logout_hint")}</div>
                </div>
                <Button type="button" variant="secondary" onClick={() => window.dispatchEvent(new Event("medoc-request-logout"))}>
                    {t("settings.account.logout_button")}
                </Button>
            </div>
        </section>
    );
}
