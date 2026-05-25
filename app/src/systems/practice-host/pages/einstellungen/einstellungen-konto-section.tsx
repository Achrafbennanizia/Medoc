import { useEffect, useMemo, useState } from "react";
import { getOwnProfile, updateOwnProfile, type OwnProfileDto } from "@/controllers/personal.controller";
import { errorMessage } from "@/lib/utils";
import { parseRole, type Role } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";

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

function rolePresentation(rolle: string | undefined): { line: string; badge: string } {
    const r = parseRole(rolle);
    const map: Record<Role, { line: string; badge: string }> = {
        ARZT: { line: "Behandelnde:r · Vollzugriff", badge: "Admin" },
        REZEPTION: { line: "Empfang · Termine & Verwaltung", badge: "Team" },
        STEUERBERATER: { line: "Auswertung · eingeschränkt", badge: "Berater" },
        PHARMABERATER: { line: "Bestellwesen · eingeschränkt", badge: "Berater" },
    };
    if (r && map[r]) return map[r];
    return { line: rolle ?? "—", badge: "—" };
}

export type EinstellungenKontoSectionProps = {
    onOpenPasswordDialog: () => void;
    /** Incremented by parent after a successful password change to refresh the „Zuletzt geändert“ hint. */
    passwordChangedTick?: number;
};

export function EinstellungenKontoSection({ onOpenPasswordDialog, passwordChangedTick = 0 }: EinstellungenKontoSectionProps) {
    const session = useAuthStore((s) => s.session);
    const setSession = useAuthStore((s) => s.setSession);
    const toast = useToastStore((s) => s.add);

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
        const t = draftKontoName.trim();
        if (!t) {
            toast("Name ist erforderlich", "error");
            return;
        }
        setKontoSaveNameBusy(true);
        try {
            const p = await updateOwnProfile({ name: t });
            applyOwnProfileToStores(p);
            toast("Name gespeichert (Praxis-Datenbank)", "success");
            setEditKontoName(false);
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setKontoSaveNameBusy(false);
        }
    }

    async function saveKontoEmail() {
        const t = draftKontoEmail.trim();
        if (!t) {
            toast("E-Mail ist erforderlich", "error");
            return;
        }
        setKontoSaveEmailBusy(true);
        try {
            const p = await updateOwnProfile({ email: t });
            applyOwnProfileToStores(p);
            toast("E-Mail gespeichert (Praxis-Datenbank)", "success");
            setEditKontoEmail(false);
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setKontoSaveEmailBusy(false);
        }
    }

    async function saveKontoTelefon() {
        setKontoSaveTelefonBusy(true);
        try {
            const p = await updateOwnProfile({ telefon: draftKontoTelefon.trim() });
            applyOwnProfileToStores(p);
            toast("Telefon gespeichert (Praxis-Datenbank)", "success");
            setEditKontoTelefon(false);
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setKontoSaveTelefonBusy(false);
        }
    }

    const rolePresent = useMemo(() => rolePresentation(session?.rolle), [session?.rolle]);
    const pwDays = useMemo(() => {
        void passwordChangedTick;
        return passwordChangedDaysAgo();
    }, [passwordChangedTick]);

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">Mein Konto</div>
                    <div className="card-sub">
                        {kontoProfileLoading
                            ? "Profil wird geladen …"
                            : ownProfileLoadError
                              ? `Profil konnte nicht geladen werden: ${ownProfileLoadError}`
                              : `${ownProfile?.name ?? session?.name ?? "—"}${ownProfile?.email || session?.email ? ` · ${ownProfile?.email ?? session?.email}` : ""}`}
                    </div>
                </div>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>Name</b>
                    <div className="settings-row-muted">{ownProfile?.name ?? session?.name ?? "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editKontoName ? (
                        <>
                            <Input
                                value={draftKontoName}
                                onChange={(e) => setDraftKontoName(e.target.value)}
                                aria-label="Name"
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
                                Speichern
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
                                Abbrechen
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
                            Bearbeiten
                        </Button>
                    )}
                </div>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>E-Mail</b>
                    <div className="settings-row-muted">{ownProfile?.email ?? session?.email ?? "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editKontoEmail ? (
                        <>
                            <Input
                                type="email"
                                value={draftKontoEmail}
                                onChange={(e) => setDraftKontoEmail(e.target.value)}
                                aria-label="E-Mail"
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
                                Speichern
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
                                Abbrechen
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
                            Bearbeiten
                        </Button>
                    )}
                </div>
            </div>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>Telefon</b>
                    <div className="settings-row-muted">{(ownProfile?.telefon ?? "").trim() || "—"}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editKontoTelefon ? (
                        <>
                            <Input
                                type="tel"
                                value={draftKontoTelefon}
                                onChange={(e) => setDraftKontoTelefon(e.target.value)}
                                aria-label="Telefon"
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
                                Speichern
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
                                Abbrechen
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
                            Bearbeiten
                        </Button>
                    )}
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>Rolle</b>
                    <div className="settings-row-muted">{rolePresent.line}</div>
                </div>
                <span className="settings-pill-blue">{rolePresent.badge}</span>
            </div>
            <div className="settings-row">
                <div>
                    <b>Passwort</b>
                    <div className="settings-row-muted">
                        {pwDays != null
                            ? `Zuletzt geändert vor ${pwDays} Tag${pwDays === 1 ? "" : "en"}`
                            : "Zuletzt geändert — über „Ändern“ aktualisieren"}
                    </div>
                </div>
                <Button variant="secondary" type="button" onClick={onOpenPasswordDialog}>
                    Ändern
                </Button>
            </div>
            <div className="settings-row">
                <div>
                    <b>Abmelden</b>
                    <div className="settings-row-muted">Sitzung beenden</div>
                </div>
                <Button type="button" variant="secondary" onClick={() => window.dispatchEvent(new Event("medoc-request-logout"))}>
                    Abmelden…
                </Button>
            </div>
        </section>
    );
}
