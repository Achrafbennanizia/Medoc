import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../models/store/auth-store";
import { changePassword, verifyLicense, checkForUpdates, openSubscriptionPortal, type LicenseStatus, type UpdateInfo } from "../../controllers/system.controller";
import { useLocale } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";

/**
 * Settings hub — account, license, updates.
 *
 * FA-EINST-01..03: Profil read-only, Passwort; Lizenz (NFA-LIC); Updates (NFA-UPD).
 * Locale: sidebar + dieser Bereich (NFA-EU-10, `medoc-locale`).
 */
export function EinstellungenPage() {
    const session = useAuthStore((s) => s.session);
    const locale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const toast = useToastStore((s) => s.add);
    const canSystemTools = session?.rolle === "ARZT";
    const [oldPw, setOldPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwBusy, setPwBusy] = useState(false);

    const [licenseToken, setLicenseToken] = useState("");
    const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
    const [licBusy, setLicBusy] = useState(false);

    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

    useEffect(() => {
        checkForUpdates()
            .then(setUpdateInfo)
            .catch((e) => {
                const msg = e instanceof Error ? e.message : String(e);
                const loc = useLocale.getState().locale;
                toast(loc === "en" ? `Update check failed: ${msg}` : `Update-Prüfung fehlgeschlagen: ${msg}`);
            });
    }, [toast]);

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

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-headline text-on-primary">Einstellungen</h2>

            <Card>
                <CardHeader title="Profil" />
                <dl className="space-y-2 text-body">
                    <div className="flex justify-between"><dt className="text-on-surface-variant">Name</dt><dd>{session?.name}</dd></div>
                    <div className="flex justify-between"><dt className="text-on-surface-variant">E-Mail</dt><dd>{session?.email}</dd></div>
                    <div className="flex justify-between"><dt className="text-on-surface-variant">Rolle</dt><dd>{session?.rolle}</dd></div>
                </dl>
                <p className="text-caption text-on-surface-variant mt-3">
                    Profildaten ändern: Personalverwaltung (nur berechtigte Rollen).
                </p>
            </Card>

            <Card>
                <CardHeader title="Sprache &amp; Anzeige (NFA-EU-10)" />
                <p className="text-body text-on-surface-variant mb-3">
                    Oberflächensprache; Einstellung wird lokal gespeichert.
                </p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label="Sprache Deutsch"
                        onClick={() => setLocale("de")}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-body-medium transition-colors",
                            locale === "de" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface hover:bg-surface-bright",
                        )}
                    >
                        Deutsch
                    </button>
                    <button
                        type="button"
                        aria-label="Language English"
                        onClick={() => setLocale("en")}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-body-medium transition-colors",
                            locale === "en" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface hover:bg-surface-bright",
                        )}
                    >
                        English
                    </button>
                </div>
            </Card>

            {canSystemTools && (
                <Card>
                    <CardHeader title="System &amp; Betrieb" />
                    <p className="text-body text-on-surface-variant mb-3">
                        Log-Level, Export und Integrität (<span className="font-mono">NFA-LOG-09/10</span>) sowie Backup
                        und Import (<span className="font-mono">NFA-SEC-05</span>) — gleiche Funktionen wie in der Seitennavigation.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            to="/logs"
                            className="inline-flex items-center px-4 py-2 rounded-md bg-primary-container text-primary text-body-medium hover:bg-primary-container/80 transition-colors"
                        >
                            Logs &amp; Observability →
                        </Link>
                        <Link
                            to="/ops"
                            className="inline-flex items-center px-4 py-2 rounded-md bg-primary-container text-primary text-body-medium hover:bg-primary-container/80 transition-colors"
                        >
                            Betrieb &amp; Datenmanagement →
                        </Link>
                    </div>
                </Card>
            )}

            <Card>
                <CardHeader title="Passwort ändern" />
                <div className="space-y-3">
                    <Input id="old-pw" type="password" label="Aktuelles Passwort" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
                    <Input id="new-pw" type="password" label="Neues Passwort (min. 8 Zeichen)" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                    <Input id="conf-pw" type="password" label="Neues Passwort wiederholen" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                    <Button onClick={handleChangePassword} disabled={pwBusy || !oldPw || !newPw}>Passwort ändern</Button>
                </div>
            </Card>

            <Card>
                <CardHeader title="Lizenz (NFA-LIC)" />
                <p className="text-body text-on-surface-variant mb-3">
                    Lizenzschlüssel im Format <code>&lt;json&gt;.&lt;signatur&gt;</code> einfügen.
                </p>
                <div className="space-y-3">
                    <Input id="lic-token" label="Lizenz-Token" value={licenseToken} onChange={(e) => setLicenseToken(e.target.value)} />
                    <div className="flex gap-2 flex-wrap">
                        <Button onClick={handleVerifyLicense} disabled={licBusy || !licenseToken}>Lizenz prüfen</Button>
                        {session?.rolle === "ARZT" && (
                            <Button variant="ghost" onClick={async () => {
                                try {
                                    const p = await openSubscriptionPortal();
                                    window.open(p.url, "_blank", "noopener,noreferrer");
                                    toast(`${p.provider}-Portal geöffnet`);
                                } catch (e) {
                                    toast(`Fehler: ${(e as Error).message ?? e}`);
                                }
                            }}>Abo verwalten</Button>
                        )}
                    </div>
                    {licenseStatus && (
                        <div className="text-body" role="status" aria-live="polite">
                            {licenseStatus.valid ? (
                                <p className="text-accent-green">
                                    ✓ Lizenz gültig — Edition <strong>{licenseStatus.license?.edition}</strong>
                                    {" "}bis <strong>{licenseStatus.license?.expires_at?.slice(0, 10)}</strong>
                                    {" "}({licenseStatus.days_until_expiry} Tage verbleibend)
                                </p>
                            ) : (
                                <p className="text-error">✗ {licenseStatus.reason ?? "Ungültig"}</p>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <CardHeader title="Updates &amp; Version (NFA-UPD / NFA-UPD-10)" />
                {updateInfo ? (
                    <p className="text-body">
                        Installierte Version: <span className="font-mono">{updateInfo.current_version}</span>{" "}
                        <span className="text-on-surface-variant">(Kanal {updateInfo.channel})</span>
                        {updateInfo.update_available
                            ? <> — <span className="text-accent-green">Neue Version {updateInfo.latest_version} verfügbar</span></>
                            : <> — <span className="text-on-surface-variant">aktuell</span></>}
                    </p>
                ) : (
                    <p className="text-body text-on-surface-variant">Update-Status konnte nicht geladen werden.</p>
                )}
            </Card>
        </div>
    );
}
