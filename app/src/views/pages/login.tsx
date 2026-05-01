import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../controllers/auth.controller";
import { EyeIcon, EyeOffIcon, PinIcon } from "@/lib/icons";
import { useT } from "@/lib/i18n";

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setHelperMsg("");
        setLoading(true);
        try {
            await login(email, passwort);
            persistRememberMe(rememberMe, email);
            navigate("/");
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
        <div className="login-root">
            <div className="login-art">
                <div style={{ position: "relative", zIndex: 1 }}>
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

            <div className="login-form-wrap">
                <form className="login-form" onSubmit={handleSubmit}>
                    <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Anmelden</h2>
                    <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 28 }}>
                        Die Berechtigung ergibt sich ausschließlich aus Ihrem Benutzerkonto — nicht aus dieser Maske.
                    </p>
                    {error && (
                        <div role="alert" style={{ background: "var(--red-soft)", color: "var(--red)", padding: "12px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                            {error}
                        </div>
                    )}
                    <label htmlFor="email" style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>E-Mail</label>
                    <input id="email" className="input-edit" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@praxis.de" required autoComplete="username" style={{ marginBottom: 12 }} />
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                        <label htmlFor="passwort" style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", display: "block" }}>Passwort</label>
                        <button
                            type="button"
                            aria-describedby="login-teaser-hint"
                            onClick={() => setHelperMsg("Passwort zurücksetzen ist für diese Demonstrator-Version nicht angebunden. In einer Ausbaustufe: Anbindung an Praxis-IT oder Selbstservice.")}
                            style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600 }}
                        >
                            Vergessen? <span style={{ fontWeight: 400, color: "var(--fg-3)" }}>(demnächst)</span>
                        </button>
                    </div>
                    <div className="input" style={{ background: "#fff", marginBottom: 8 }}>
                        <input
                            id="passwort"
                            className="input-edit"
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
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 14, color: "var(--fg-3)", fontSize: 12.5, flexWrap: "wrap", gap: 8 }}>
                        <label className="row" style={{ gap: 8 }}>
                            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                            E-Mail auf diesem Gerät merken
                        </label>
                        <span style={{ color: "var(--fg-4)" }} title="Für den Demonstrator nicht implementiert">Zusätzliche Anmeldung (2FA): nicht aktiv</span>
                    </div>
                    <button type="submit" className="login-submit" disabled={loading}>
                        {loading ? <span className="animate-spin" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.5)", borderTopColor: "#fff", borderRadius: "50%" }} /> : null}
                        Anmelden
                    </button>
                    <div className="login-alt">oder</div>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        style={{ width: "100%", justifyContent: "center", padding: 11 }}
                        aria-describedby="login-teaser-hint"
                        onClick={() => setHelperMsg("Anmeldung mit HBA/eHC Karte ist für diese Version nicht implementiert — zunächst Passwort-Anmeldung verwenden.")}
                    >
                        Mit HBA-Karte anmelden <span style={{ fontWeight: 400, color: "var(--fg-3)" }}>(demnächst)</span>
                    </button>
                    <p id="login-teaser-hint" className="sr-only">
                        Die mit „demnächst“ gekennzeichneten Aktionen sind Platzhalter ohne Produktfunktion.
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
                    <p style={{ textAlign: "center", color: "var(--fg-4)", fontSize: 12, marginTop: 16 }}>
                        Entwicklung: Zugangsdaten aus Seed-/Fixture-SQL oder lokaler Admin-Anlage — keine fest eingetragenen Demo-Passwörter.
                    </p>
                )}
            </div>
        </div>
    );
}
