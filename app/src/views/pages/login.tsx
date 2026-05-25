import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/systems/practice-host/controllers/auth.controller";
import {
    confirmTotpEnrollmentLogin,
    startTotpEnrollmentLogin,
    type TotpEnrollment,
} from "@/systems/practice-host/controllers/totp.controller";
import { isTotpEnrollError, isTotpVerifyError } from "@/lib/login-totp-errors";
import { EyeIcon, EyeOffIcon, PinIcon } from "@/lib/icons";
import { useT } from "@/lib/i18n";
import { useDesktopChromeMode } from "../components/desktop-chrome";
import { useMacWindowDrag } from "@/lib/mac-window-drag";

const LS_REMEMBER_EMAIL = "medoc-login-remember-email";
const LS_REMEMBER_FLAG = "medoc-login-remember-me";

function readRememberedEmail(): string {
    try {
        if (localStorage.getItem(LS_REMEMBER_FLAG) !== "1") return "";
        return localStorage.getItem(LS_REMEMBER_EMAIL) ?? "";
    } catch {
        return "";
    }
}

function persistRememberMe(remember: boolean, email: string) {
    try {
        if (remember && email.trim()) {
            localStorage.setItem(LS_REMEMBER_FLAG, "1");
            localStorage.setItem(LS_REMEMBER_EMAIL, email.trim());
        } else {
            localStorage.removeItem(LS_REMEMBER_FLAG);
            localStorage.removeItem(LS_REMEMBER_EMAIL);
        }
    } catch {
        /* ignore quota / private mode */
    }
}

function formatLoginError(err: unknown, rateLimitedMsg: string): string {
    const raw =
        typeof err === "string" ? err : err instanceof Error ? err.message : (() => {
            try {
                return JSON.stringify(err);
            } catch {
                return "";
            }
        })();
    const lower = raw.toLowerCase();
    if (
        lower.includes("rate") ||
        lower.includes("429") ||
        lower.includes("throttle") ||
        lower.includes("zu viele") ||
        lower.includes("too many")
    ) {
        return rateLimitedMsg;
    }
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return "Anmeldung fehlgeschlagen";
    }
}

export function LoginPage() {
    const t = useT();
    const [email, setEmail] = useState(readRememberedEmail);
    const [passwort, setPasswort] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(() => {
        try {
            return localStorage.getItem(LS_REMEMBER_FLAG) === "1";
        } catch {
            return false;
        }
    });
    const [helperMsg, setHelperMsg] = useState("");
    const [capsOn, setCapsOn] = useState(false);
    const navigate = useNavigate();
    const [showPw, setShowPw] = useState(false);
    const [step, setStep] = useState<"credentials" | "totp" | "enroll">("credentials");
    const [totpCode, setTotpCode] = useState("");
    const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
    const [enrollCode, setEnrollCode] = useState("");
    const desktopChrome = useDesktopChromeMode();
    const isMacOverlay = desktopChrome === "mac-overlay";
    const handleMacWindowDrag = useMacWindowDrag(isMacOverlay);

    const deviceOpts = {
        device_label: typeof window !== "undefined" ? `MeDoc · ${window.location.hostname || "app"}` : "MeDoc",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };

    const finishLogin = async (totp?: string) => {
        await login(email, passwort, { ...deviceOpts, totp_code: totp });
        persistRememberMe(rememberMe, email);
        navigate("/");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setHelperMsg("");
        setLoading(true);
        try {
            if (step === "totp") {
                await finishLogin(totpCode.trim());
                return;
            }
            if (step === "enroll") {
                await confirmTotpEnrollmentLogin(email, passwort, enrollCode.trim());
                await finishLogin(enrollCode.trim());
                return;
            }
            try {
                await finishLogin();
            } catch (err) {
                if (isTotpEnrollError(err)) {
                    const dto = await startTotpEnrollmentLogin(email, passwort);
                    setEnrollment(dto);
                    setStep("enroll");
                    setError("");
                    return;
                }
                if (isTotpVerifyError(err)) {
                    setStep("totp");
                    setError("");
                    return;
                }
                throw err;
            }
        } catch (err) {
            setError(formatLoginError(err, t("login.rate_limited")));
        } finally {
            setLoading(false);
        }
    };

    const handleStartEnroll = async () => {
        setError("");
        setLoading(true);
        try {
            const dto = await startTotpEnrollmentLogin(email, passwort);
            setEnrollment(dto);
        } catch (err) {
            setError(formatLoginError(err, t("login.rate_limited")));
        } finally {
            setLoading(false);
        }
    };

    const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.getModifierState) {
            setCapsOn(e.getModifierState("CapsLock"));
        }
    };

    return (
        <div className={`login-root${isMacOverlay ? " login-root--mac" : ""}`}>
            {isMacOverlay ? (
                <header
                    className="login-window-chrome"
                    data-tauri-drag-region
                    onMouseDown={handleMacWindowDrag}
                    aria-label="Fenster verschieben"
                >
                    <span className="login-window-chrome__hint" aria-hidden>
                        MeDoc
                    </span>
                </header>
            ) : null}
            <div className="login-root__panels">
            <div
                className={`login-art${isMacOverlay ? " login-art--mac-drag" : ""}`}
                data-tauri-drag-region={isMacOverlay ? true : undefined}
                onMouseDown={isMacOverlay ? handleMacWindowDrag : undefined}
            >
                <div className="login-art__content" style={{ position: "relative", zIndex: 1 }}>
                    <div className="row" style={{ gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "grid", placeItems: "center" }}>
                            <PinIcon size={18} />
                        </div>
                        <div style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>MeDoc <span style={{ opacity: 0.6, fontWeight: 400 }}>Praxisverwaltung</span></div>
                    </div>
                    <div style={{ marginTop: 48 }}>
                        <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 14px", maxWidth: 460, lineHeight: 1.05 }}>
                            Behandeln Sie Patienten — nicht Software.
                        </h1>
                        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", maxWidth: 460, lineHeight: 1.55 }}>
                            Termine, Akten, Abrechnung und Rezepte in einer ruhigen, fokussierten Oberfläche. Hinweis: Dieser Stand ist ein Entwicklungs-
                            / Hochschul-Demonstrator — keine Produktzertifizierung und keine fest verdrahtete Hosting-Region.
                        </p>
                    </div>
                </div>
                <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "rgba(255,255,255,0.55)", display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <span>Demonstrator · nicht für den klinischen Routinebetrieb freigegeben</span>
                    <span aria-hidden>·</span>
                    <span>Build {import.meta.env.VITE_APP_VERSION ?? import.meta.env.MODE}</span>
                </div>
            </div>

            <div
                className={`login-form-wrap${isMacOverlay ? " login-form-wrap--mac-drag" : ""}`}
                data-tauri-drag-region={isMacOverlay ? true : undefined}
                onMouseDown={isMacOverlay ? handleMacWindowDrag : undefined}
            >
                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="row" style={{ alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }} tabIndex={-1}>
                            Anmelden
                        </h2>
                        {import.meta.env.DEV ? (
                            <span
                                className="pill solid-amber"
                                title="Nur in Entwicklungs-Builds sichtbar"
                                style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}
                            >
                                Dev-Build
                            </span>
                        ) : null}
                    </div>
                    <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 28 }}>
                        Die Rolle entsteht ausschließlich aus Ihrem Benutzerkonto nach erfolgreicher Anmeldung — nicht über
                        Einstellungen auf dieser Seite.
                    </p>
                    {error && (
                        <div role="alert" style={{ background: "var(--red-soft)", color: "var(--red)", padding: "12px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                            {error}
                        </div>
                    )}
                    {step === "enroll" ? (
                        <>
                            <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 16 }}>
                                Als Arzt ist die Zwei-Faktor-Authentifizierung Pflicht. Scannen Sie den Schlüssel in Ihrer
                                Authenticator-App (z. B. FreeOTP, Google Authenticator).
                            </p>
                            {!enrollment ? (
                                <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void handleStartEnroll()}>
                                    Einrichtung starten
                                </button>
                            ) : (
                                <>
                                    <p style={{ fontSize: 12, color: "var(--fg-3)", wordBreak: "break-all" }}>
                                        Manueller Schlüssel: <code>{enrollment.secret_base32}</code>
                                    </p>
                                    <p style={{ fontSize: 12, color: "var(--fg-3)", wordBreak: "break-all" }}>
                                        <a href={enrollment.provisioning_uri}>otpauth://-Link öffnen</a>
                                    </p>
                                    <label htmlFor="enroll-code" className="form-label">Bestätigungscode</label>
                                    {import.meta.env.DEV ? (
                                        <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 8px" }}>
                                            Dev-Build: <code>1234</code> reicht — kein Authenticator nötig.
                                        </p>
                                    ) : null}
                                    <input
                                        id="enroll-code"
                                        className="input-edit"
                                        inputMode="numeric"
                                        pattern={import.meta.env.DEV ? "[0-9]{4,6}" : "[0-9]{6}"}
                                        maxLength={6}
                                        value={enrollCode}
                                        onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        required
                                        style={{ marginBottom: 16 }}
                                    />
                                </>
                            )}
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ marginBottom: 12 }}
                                onClick={() => {
                                    setStep("credentials");
                                    setEnrollment(null);
                                    setEnrollCode("");
                                }}
                            >
                                Zurück
                            </button>
                        </>
                    ) : null}
                    {step === "totp" ? (
                        <>
                            <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 16 }}>
                                Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.
                                {import.meta.env.DEV ? (
                                    <> Dev-Build: alternativ <code>1234</code> eingeben.</>
                                ) : null}
                            </p>
                            <label htmlFor="totp-code" className="form-label">Authenticator-Code</label>
                            <input
                                id="totp-code"
                                className="input-edit"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern={import.meta.env.DEV ? "[0-9]{4,6}" : "[0-9]{6}"}
                                maxLength={6}
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                required
                                style={{ marginBottom: 16, letterSpacing: "0.2em", fontSize: 18 }}
                            />
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ marginBottom: 12 }}
                                onClick={() => {
                                    setStep("credentials");
                                    setTotpCode("");
                                }}
                            >
                                Zurück
                            </button>
                        </>
                    ) : null}
                    {step === "credentials" ? (
                    <>
                    <label htmlFor="email" className="form-label">E-Mail</label>
                    <input id="email" className="input-edit" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@praxis.de" required autoComplete="username" style={{ marginBottom: 12 }} />
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                        <label htmlFor="passwort" className="form-label form-label--mb-0">Passwort</label>
                        <button
                            type="button"
                            aria-describedby="login-teaser-hint"
                            onClick={() => setHelperMsg("Passwort zurücksetzen ist für diese Demonstrator-Version nicht angebunden. In einer Ausbaustufe: Anbindung an Praxis-IT oder Selbstservice.")}
                            style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600 }}
                        >
                            Vergessen? <span style={{ fontWeight: 400, color: "var(--fg-3)" }}>(demnächst)</span>
                        </button>
                    </div>
                    <div className="input login-password-input-row" style={{ marginBottom: 8 }}>
                        <input
                            id="passwort"
                            className="input-edit login-password-input-row__field"
                            style={{ border: 0, boxShadow: "none", padding: 0 }}
                            type={showPw ? "text" : "password"}
                            value={passwort}
                            onChange={(e) => setPasswort(e.target.value)}
                            onKeyDown={onPasswordKey}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 28, height: 28 }}
                            aria-label={showPw ? t("login.pw_toggle_hide") : t("login.pw_toggle_show")}
                            onClick={() => setShowPw((v) => !v)}
                        >
                            {showPw ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                        </button>
                    </div>
                    {capsOn ? (
                        <p role="status" style={{ color: "var(--orange)", fontSize: 12.5, fontWeight: 600, margin: "0 0 12px" }}>
                            {t("login.caps_warning")}
                        </p>
                    ) : null}
                    <div className="row" style={{ marginBottom: 14, color: "var(--fg-3)", fontSize: 12.5, flexWrap: "wrap", gap: 8 }}>
                        <label className="row" style={{ gap: 8 }}>
                            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                            E-Mail auf diesem Gerät merken (nur lokal, für die nächste Anmeldung vorbefüllen)
                        </label>
                    </div>
                    </>
                    ) : null}
                    <button
                        type="submit"
                        className="login-submit"
                        disabled={loading || (step === "enroll" && !enrollment)}
                    >
                        {loading ? (
                            <span
                                className="animate-spin"
                                style={{
                                    width: 14,
                                    height: 14,
                                    border: "2px solid rgba(255,255,255,0.5)",
                                    borderTopColor: "#fff",
                                    borderRadius: "50%",
                                }}
                            />
                        ) : null}
                        {step === "totp" ? "Code prüfen" : step === "enroll" ? "Einrichtung abschließen" : "Anmelden"}
                    </button>
                    <p id="login-teaser-hint" className="sr-only">
                        Zertifizierungs- und Infrastruktur-Claims erscheinen nur, wenn sie produktiv hinterlegt sind.
                    </p>
                    {helperMsg ? (
                        <div style={{ marginTop: 10, color: "var(--blue)", fontSize: 12.5 }} role="status">{helperMsg}</div>
                    ) : null}
                    <div id="login-notfall-hinweis" style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-2)", marginBottom: 6 }}>{t("login.notfall.title")}</div>
                        <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.45 }}>{t("login.notfall.body")}</p>
                    </div>
                </form>
                {import.meta.env.DEV && (
                    <p style={{ textAlign: "center", color: "var(--fg-3)", fontSize: 12, marginTop: 14, maxWidth: 420, marginLeft: "auto", marginRight: "auto", lineHeight: 1.45 }}>
                        <strong>Dev-Build:</strong> Anmeldedaten stammen aus Ihrer lokalen Datenbank (Seed-/Fixture-SQL oder
                        manuell angelegter Benutzer) — es gibt hier keine fest eingetragenen Demo-Passwörter.
                    </p>
                )}
            </div>
            </div>
        </div>
    );
}
