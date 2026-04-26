import { useEffect, useState } from "react";
import { createBackup } from "../../controllers/ops.controller";
import { useAuthStore } from "../../models/store/auth-store";
import {
    changePassword,
    verifyLicense,
    openSubscriptionPortal,
    type LicenseStatus,
    currentAppVersion,
    checkForUpdates,
    attachPaymentMethod,
} from "../../controllers/system.controller";
import { useLocale } from "../../lib/i18n";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { Dialog } from "../components/ui/dialog";

/**
 * Settings hub — account, license, updates.
 *
 * FA-EINST-01..03: Profil read-only, Passwort; Lizenz (NFA-LIC); Updates (NFA-UPD).
 * Locale: sidebar + dieser Bereich (NFA-EU-10, `medoc-locale`).
 */
const ACCENT_KEY = "medoc-accent-preset";

type AccentId = "mint" | "ocean" | "plum";

const ACCENT_LABELS: Record<AccentId, string> = {
    mint: "Mint",
    ocean: "Ocean",
    plum: "Plum",
};

function applyAccentPreset(id: AccentId) {
    const presets: Record<AccentId, { accent: string; soft: string; ink: string }> = {
        mint: { accent: "#0EA07E", soft: "#DCF3EC", ink: "#06604B" },
        ocean: { accent: "#0A84FF", soft: "#E5F1FF", ink: "#0355B7" },
        plum: { accent: "#AF52DE", soft: "#F2E4FB", ink: "#6B2A95" },
    };
    const v = presets[id];
    document.documentElement.style.setProperty("--accent", v.accent);
    document.documentElement.style.setProperty("--accent-soft", v.soft);
    document.documentElement.style.setProperty("--accent-ink", v.ink);
    localStorage.setItem(ACCENT_KEY, id);
}

export function EinstellungenPage() {
    type SettingsSection = "praxis" | "konto" | "benachrichtigung" | "sicherheit" | "lizenz" | "integrationen" | "migration" | "darstellung";
    const session = useAuthStore((s) => s.session);
    const locale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const toast = useToastStore((s) => s.add);
    const [oldPw, setOldPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwBusy, setPwBusy] = useState(false);

    const [licenseToken, setLicenseToken] = useState("");
    const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
    const [licBusy, setLicBusy] = useState(false);
    const [appVersion, setAppVersion] = useState<string>("…");
    const [updateBusy, setUpdateBusy] = useState(false);
    const [paymentToken, setPaymentToken] = useState("");
    const [paymentBusy, setPaymentBusy] = useState(false);

    useEffect(() => {
        // FA-EINST / NFA-UPD-10 — surface the currently-running binary version.
        let cancelled = false;
        currentAppVersion()
            .then((v) => { if (!cancelled) setAppVersion(v); })
            .catch(() => { if (!cancelled) setAppVersion("?"); });
        return () => { cancelled = true; };
    }, []);

    async function handleCheckUpdates() {
        setUpdateBusy(true);
        try {
            const info = await checkForUpdates();
            toast(
                info.update_available
                    ? `Update verfügbar: ${info.latest_version}`
                    : `Aktuell auf neuester Version (${info.current_version})`,
                info.update_available ? "info" : "success",
            );
        } catch (e) {
            toast(`Update-Prüfung fehlgeschlagen: ${(e as Error).message ?? e}`);
        } finally {
            setUpdateBusy(false);
        }
    }

    async function handleAttachPayment() {
        const token = paymentToken.trim();
        if (!token) return;
        setPaymentBusy(true);
        try {
            await attachPaymentMethod({ provider_token: token });
            toast("Zahlungsmethode hinterlegt", "success");
            setPaymentToken("");
        } catch (e) {
            toast(`Zahlungsmethode konnte nicht hinterlegt werden: ${(e as Error).message ?? e}`);
        } finally {
            setPaymentBusy(false);
        }
    }

    const [activeSection, setActiveSection] = useState<SettingsSection>("praxis");
    const [pushEnabled, setPushEnabled] = useState(true);
    const [mailDigestEnabled, setMailDigestEnabled] = useState(true);
    const [smsEnabled, setSmsEnabled] = useState(false);
    const [darkModeEnabled, setDarkModeEnabled] = useState(false);
    const [accentDialogOpen, setAccentDialogOpen] = useState(false);
    const [backupBusy, setBackupBusy] = useState(false);
    const [accentLabel, setAccentLabel] = useState("Mint");

    useEffect(() => {
        const saved = localStorage.getItem(ACCENT_KEY) as AccentId | null;
        if (saved === "ocean" || saved === "plum" || saved === "mint") {
            applyAccentPreset(saved);
            setAccentLabel(ACCENT_LABELS[saved]);
        }
    }, []);

    async function handleChangePassword() {
        if (newPw.length < 8) {
            toast("Passwort muss mindestens 8 Zeichen lang sein");
            return;
        }
        if (newPw !== confirmPw) {
            toast("Passwörter stimmen nicht überein");
            return;
        }
        setPwBusy(true);
        try {
            await changePassword(oldPw, newPw);
            toast("Passwort geändert");
            setOldPw(""); setNewPw(""); setConfirmPw("");
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`);
        } finally {
            setPwBusy(false);
        }
    }

    async function handleVerifyLicense() {
        if (!licenseToken.trim()) return;
        setLicBusy(true);
        try {
            setLicenseStatus(await verifyLicense(licenseToken.trim()));
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`);
        } finally {
            setLicBusy(false);
        }
    }

    const toggleSetting = (label: string, value: boolean, setter: (next: boolean) => void) => {
        const next = !value;
        setter(next);
        toast(`${label}: ${next ? "aktiviert" : "deaktiviert"}`, "info");
    };

    const menuItems: Array<{ id: SettingsSection; label: string }> = [
        { id: "praxis", label: "Praxis" },
        { id: "konto", label: "Konto" },
        { id: "benachrichtigung", label: "Benachrichtigungen" },
        { id: "sicherheit", label: "Sicherheit" },
        { id: "lizenz", label: "Lizenz & Abo" },
        { id: "integrationen", label: "Integrationen" },
        { id: "migration", label: "Migration" },
        { id: "darstellung", label: "Darstellung" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in--sticky-safe">
            <h2 className="page-title">Einstellungen</h2>
            <div className="page-sub">Praxis · Konto · Sicherheit · Lizenz · Integrationen</div>

            <div className="split settings-shell" style={{ gridTemplateColumns: "minmax(200px, 240px) 1fr", alignItems: "start" }}>
                <div className="card card-pad settings-nav">
                    <div className="col">
                        {menuItems.map((item) => (
                            <button key={item.id} className={`sb-item settings-nav-item ${activeSection === item.id ? "active" : ""}`} onClick={() => setActiveSection(item.id)}>
                                <span className="settings-nav-dot" aria-hidden />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="card settings-panel" style={{ overflow: "hidden" }}>
                    {activeSection === "praxis" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Praxis</div><div className="card-sub">Grunddaten · werden auf Rezepten und Rechnungen gedruckt</div></div></div>
                            <div className="settings-row"><div><b>Praxisname*</b><div className="card-sub">Zahnarzt-Praxis Nord</div></div><span className="settings-chevron">›</span></div>
                            <div className="settings-row"><div><b>Adresse*</b><div className="card-sub">Kastanienallee 22, 10435 Berlin</div></div><span className="settings-chevron">›</span></div>
                            <div className="settings-row"><div><b>Öffnungszeiten</b><div className="card-sub">Mo-Fr 08:00-18:00 · Sa 09:00-13:00</div></div><span className="settings-chevron">›</span></div>
                            <div className="settings-row"><div><b>KV-Nummer*</b><div className="card-sub">12345678</div></div><span className="settings-chevron">›</span></div>
                            <div className="settings-row"><div><b>Logo</b><div className="card-sub">Wird auf Dokumenten im PDF-Export verwendet</div></div><button className="btn btn-subtle" type="button">Hochladen</button></div>
                        </section>
                    ) : null}

                    {activeSection === "konto" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Mein Konto</div><div className="card-sub">{session?.name} · {session?.email}</div></div></div>
                            <div className="settings-row"><div><b>Name</b><div className="card-sub">{session?.name}</div></div><span className="settings-chevron">›</span></div>
                            <div className="settings-row"><div><b>E-Mail</b><div className="card-sub">{session?.email}</div></div><span className="settings-chevron">›</span></div>
                            <div className="settings-row"><div><b>Rolle</b><div className="card-sub">{session?.rolle} · Vollzugriff</div></div><span className="pill blue">Admin</span></div>
                            <div className="settings-row"><div><b>Passwort</b><div className="card-sub">Zuletzt geändert vor 42 Tagen</div></div><button className="btn btn-subtle" type="button" onClick={() => setAccentDialogOpen(true)}>Ändern</button></div>
                            <div className="settings-row"><div><b>Sprache</b><div className="card-sub">Aktuelle Sprache: {locale.toUpperCase()}</div></div><div className="row"><button className={`btn ${locale === "de" ? "btn-accent" : "btn-subtle"}`} onClick={() => setLocale("de")} type="button">DE</button><button className={`btn ${locale === "en" ? "btn-accent" : "btn-subtle"}`} onClick={() => setLocale("en")} type="button">EN</button></div></div>
                        </section>
                    ) : null}

                    {activeSection === "benachrichtigung" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Benachrichtigungen</div></div></div>
                            <div className="settings-row"><div><b>Push-Benachrichtigungen</b><div className="card-sub">Neue Freigaben, Termine, Bestellungen</div></div><input type="checkbox" checked={pushEnabled} onChange={() => toggleSetting("Push-Benachrichtigungen", pushEnabled, setPushEnabled)} /></div>
                            <div className="settings-row"><div><b>E-Mail-Zusammenfassung</b><div className="card-sub">Täglich um 18:00</div></div><input type="checkbox" checked={mailDigestEnabled} onChange={() => toggleSetting("E-Mail-Zusammenfassung", mailDigestEnabled, setMailDigestEnabled)} /></div>
                            <div className="settings-row"><div><b>Kritische Warnungen</b><div className="card-sub">Lagerbestand, Freigaben über 24h</div></div><input type="checkbox" checked={pushEnabled} onChange={() => toggleSetting("Kritische Warnungen", pushEnabled, setPushEnabled)} /></div>
                            <div className="settings-row"><div><b>Patienten-SMS (Erinnerungen)</b><div className="card-sub">24h vor dem Termin</div></div><input type="checkbox" checked={smsEnabled} onChange={() => toggleSetting("Patienten-SMS", smsEnabled, setSmsEnabled)} /></div>
                        </section>
                    ) : null}

                    {activeSection === "sicherheit" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Sicherheit</div><div className="card-sub">DSGVO-Status · Audit-Protokolle · Zugriffskontrolle</div></div><span className="pill green">Konform</span></div>
                            <div className="settings-row"><div><b>Zwei-Faktor-Authentifizierung</b><div className="card-sub">Per Authenticator-App · Pflicht ab 01.06.2026</div></div><input type="checkbox" checked={pushEnabled} onChange={() => toggleSetting("2FA", pushEnabled, setPushEnabled)} /></div>
                            <div className="settings-row"><div><b>Auto-Sperre nach Inaktivität</b><div className="card-sub">Nach 5 Minuten — sperrt Arbeitsplatz & Akten</div></div><input type="checkbox" checked={mailDigestEnabled} onChange={() => toggleSetting("Auto-Sperre", mailDigestEnabled, setMailDigestEnabled)} /></div>
                            <div className="settings-row"><div><b>HBA / eGK Kartenleser</b><div className="card-sub">Orga 6141 · Terminal-ID 8800-4421</div></div><span className="pill green">Verbunden</span></div>
                            <div className="settings-row"><div><b>Audit-Protokoll</b><div className="card-sub">Letzte 90 Tage · 14.842 Ereignisse</div></div><Button variant="ghost" onClick={() => toast("Audit-Protokoll geöffnet", "success")}>Anzeigen</Button></div>
                        </section>
                    ) : null}

                    {activeSection === "lizenz" ? (
                        <section>
                            <div className="settings-highlight-card" style={{ margin: 18, border: "1px solid #6ea9d8", borderRadius: 16, padding: 16, background: "#f7fbff" }}>
                                <div className="row settings-highlight-head" style={{ justifyContent: "space-between" }}>
                                    <span className="pill blue">Aktiv</span>
                                    <span style={{ color: "var(--fg-3)", fontSize: 12 }}>Ihr Plan</span>
                                </div>
                                <div style={{ fontSize: "clamp(30px, 5vw, 36px)", fontWeight: 700, marginTop: 8, lineHeight: 1.15 }}>MeDoc Praxis <span style={{ color: "var(--blue)" }}>Pro</span></div>
                                <div className="card-sub">Bis zu 8 Behandler · Unbegrenzt Patienten · eRezept · DATEV-Export · Premium Support</div>
                                <div className="row settings-license-grid" style={{ marginTop: 10, justifyContent: "space-between" }}>
                                    <div><div className="card-sub">Monatsgebühr</div><b style={{ fontSize: "clamp(30px, 5vw, 40px)" }}>€ 189,00</b></div>
                                    <div><div className="card-sub">Nächste Abbuchung</div><b>01.05.2026</b></div>
                                    <div><div className="card-sub">Zahlungsmethode</div><b>SEPA ·· 4821</b></div>
                                    <div className="row settings-license-actions"><Button variant="ghost" onClick={() => void handleVerifyLicense()} disabled={licBusy}>Rechnungen</Button><Button onClick={async () => { const p = await openSubscriptionPortal(); window.open(p.url, "_blank", "noopener,noreferrer"); }}>Plan wechseln</Button></div>
                                </div>
                            </div>
                            <div className="card-head"><div><div className="card-title">Lizenz-Details</div></div></div>
                            <div className="settings-row"><div><b>Lizenznummer</b><div className="card-sub">MD-PRO-DE-2026-0448-MR</div></div><Button variant="ghost" onClick={() => toast("Lizenznummer kopiert", "success")}>Kopieren</Button></div>
                            <div className="settings-row"><div><b>KBV-Zulassung</b><div className="card-sub">Zugelassen bis 31.12.2027</div></div><span className="pill green">Aktiv</span></div>
                            <div className="settings-row"><div><b>Support-Vertrag</b><div className="card-sub">Premium · 24/7 · Antwort &lt; 2h</div></div><span className="settings-chevron">›</span></div>
                            <div className="card-head" style={{ marginTop: 16 }}><div><div className="card-title">Über &amp; Updates</div><div className="card-sub">NFA-UPD-10 · Aktuell installierte Version</div></div></div>
                            <div className="settings-row"><div><b>App-Version</b><div className="card-sub">MeDoc {appVersion}</div></div><Button variant="ghost" onClick={() => void handleCheckUpdates()} disabled={updateBusy} loading={updateBusy}>Nach Updates suchen</Button></div>
                            <div className="card-head" style={{ marginTop: 16 }}><div><div className="card-title">Zahlungsmethode</div><div className="card-sub">FA-PAY-02 · Provider-Token (z. B. Stripe pm_…) — keine Kartendaten lokal</div></div></div>
                            <div className="settings-row" style={{ alignItems: "flex-end", gap: 12 }}>
                                <div style={{ flex: 1 }}><Input id="pay-token" label="Provider-Token" placeholder="pm_… oder tok_…" value={paymentToken} onChange={(e) => setPaymentToken(e.target.value)} /></div>
                                <Button onClick={() => void handleAttachPayment()} disabled={paymentBusy || !paymentToken.trim()} loading={paymentBusy}>Hinterlegen</Button>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "integrationen" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Integrationen</div></div></div>
                            <div className="settings-row"><div><b>eRezept (Gematik)</b><div className="card-sub">Verbunden · Kartenterminal OK</div></div><span className="pill green">Aktiv</span></div>
                            <div className="settings-row"><div><b>DATEV</b><div className="card-sub">Monatlicher Buchhaltungsexport</div></div><input type="checkbox" checked={mailDigestEnabled} onChange={() => toggleSetting("DATEV", mailDigestEnabled, setMailDigestEnabled)} /></div>
                            <div className="settings-row"><div><b>DocCheck SSO</b><div className="card-sub">Single Sign-On für Team</div></div><span className="pill grey">Nicht verbunden</span></div>
                            <div className="settings-row"><div><b>TK-Direktabrechnung</b><div className="card-sub">Kassenzahnärztliche Abrechnung via KIM</div></div><span className="pill green">Aktiv</span></div>
                            <div className="settings-row"><div><b>Labor (Dental Union)</b><div className="card-sub">Auftragsweiterleitung</div></div><span className="pill blue">Beta</span></div>
                        </section>
                    ) : null}

                    {activeSection === "migration" ? (
                        <section>
                            <div className="settings-highlight-card" style={{ margin: 18, border: "1px solid #6ea9d8", borderRadius: 16, padding: 16, background: "#f7fbff" }}>
                                <div className="row settings-highlight-head" style={{ justifyContent: "space-between" }}>
                                    <div>
                                        <b>Migration aus Alt-System</b>
                                        <div className="card-sub">Übertragen Sie Patienten, Akten, Termine und Abrechnungen in wenigen Minuten.</div>
                                    </div>
                                    <span className="pill blue">Einmalig</span>
                                </div>
                                <div className="row settings-migration-steps" style={{ marginTop: 14, justifyContent: "space-between" }}>
                                    <span className="pill green">Quellsystem</span>
                                    <span className="pill green">Verbindung</span>
                                    <span className="pill blue">Zuordnung</span>
                                    <span className="pill grey">Import</span>
                                    <span className="pill grey">Abschluss</span>
                                </div>
                                <div className="row settings-migration-actions" style={{ marginTop: 14, justifyContent: "flex-end" }}>
                                    <Button variant="ghost" onClick={() => toast("Migration abgebrochen", "info")}>Abbrechen</Button>
                                    <Button onClick={() => toast("Migration fortgesetzt", "success")}>Fortsetzen</Button>
                                </div>
                            </div>
                            <div className="card-head"><div><div className="card-title">Backups & Export</div><div className="card-sub">Automatisch jede Nacht um 02:00 · verschlüsselt in Frankfurt</div></div></div>
                            <div className="settings-row"><div><b>Letztes Backup</b><div className="card-sub">23.04.2026 02:03 · 4,2 GB · erfolgreich</div></div><span className="pill green">OK</span></div>
                            <div className="settings-row"><div><b>Backup jetzt starten</b><div className="card-sub">Dauer ca. 8-12 Minuten</div></div><Button loading={backupBusy} disabled={backupBusy} onClick={async () => { setBackupBusy(true); try { await createBackup(); toast("Backup wurde erstellt.", "success"); } catch (e) { toast(`Backup fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`); } finally { setBackupBusy(false); } }}>Jetzt sichern</Button></div>
                            <div className="settings-row"><div><b>Backup wiederherstellen</b><div className="card-sub">Aus Cloud oder lokaler Datei</div></div><span className="settings-chevron">›</span></div>
                        </section>
                    ) : null}

                    {activeSection === "darstellung" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Darstellung</div></div></div>
                            <div className="settings-row"><div><b>Dark Mode</b><div className="card-sub">Nur Sidebar dunkel · Arbeitsbereich hell</div></div><input type="checkbox" checked={darkModeEnabled} onChange={() => toggleSetting("Dark Mode", darkModeEnabled, setDarkModeEnabled)} /></div>
                            <div className="settings-row"><div><b>Systemschrift</b><div className="card-sub">Inter · 14 pt</div></div><span className="settings-chevron">›</span></div>
                            <div className="settings-row"><div><b>Dichte</b><div className="card-sub">Gemütlich · Kompakt · Weit</div></div><span className="settings-chevron">›</span></div>
                            <div className="settings-row"><div><b>Akzentfarbe</b><div className="card-sub">Mint · siehe Tweaks</div></div><button type="button" className="pill blue" onClick={() => setAccentDialogOpen(true)}>{accentLabel}</button></div>
                        </section>
                    ) : null}
                </div>
            </div>

            <Dialog
                open={accentDialogOpen}
                onClose={() => setAccentDialogOpen(false)}
                title="Passwort / Akzent"
                footer={
                    <Button variant="ghost" onClick={() => setAccentDialogOpen(false)}>
                        Schließen
                    </Button>
                }
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Input id="old-pw" type="password" label="Aktuelles Passwort" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
                    <Input id="new-pw" type="password" label="Neues Passwort (min. 8 Zeichen)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                    <Input id="conf-pw" type="password" label="Neues Passwort wiederholen" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                    <Button onClick={handleChangePassword} disabled={pwBusy || !oldPw || !newPw}>Passwort ändern</Button>
                    <Input id="lic-token" label="Lizenz-Token" value={licenseToken} onChange={(e) => setLicenseToken(e.target.value)} />
                    <Button variant="ghost" onClick={() => void handleVerifyLicense()} disabled={licBusy || !licenseToken}>Lizenz prüfen</Button>
                    {licenseStatus ? <p style={{ color: licenseStatus.valid ? "var(--accent)" : "var(--red)", margin: 0 }}>{licenseStatus.valid ? "Lizenz gültig" : `Ungültig: ${licenseStatus.reason ?? "Fehler"}`}</p> : null}
                    <p style={{ color: "var(--fg-3)", fontSize: 14, margin: "6px 0 0" }}>Akzentfarbe:</p>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        {(["mint", "ocean", "plum"] as const).map((id) => (
                            <Button
                                key={id}
                                variant={accentLabel === ACCENT_LABELS[id] ? undefined : "ghost"}
                                onClick={() => {
                                    applyAccentPreset(id);
                                    setAccentLabel(ACCENT_LABELS[id]);
                                    toast(`Akzent: ${ACCENT_LABELS[id]}`, "success");
                                }}
                            >
                                {ACCENT_LABELS[id]}
                            </Button>
                        ))}
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
