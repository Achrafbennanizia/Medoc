import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../controllers/auth.controller";
import { EyeIcon, EyeOffIcon, PinIcon } from "@/lib/icons";
import { useT } from "@/lib/i18n";

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
    const [role, setRole] = useState<"arzt" | "assistenz" | "verwaltung">("arzt");
    const [email, setEmail] = useState("marina.reuss@medoc.de");
    const [passwort, setPasswort] = useState("passwort123");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
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
                            Termine, Akten, Abrechnung und Rezepte in einer ruhigen, fokussierten Oberfläche. DSGVO- und KBV-konform. Fuer zahnärztliche Praxen jeder Größe.
                        </p>
                    </div>
                </div>
                <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "rgba(255,255,255,0.55)", display: "flex", gap: 18 }}>
                    <span>🔒 BSI-zertifiziert</span>
                    <span>☁ Serverstandort Frankfurt</span>
                    <span>Version 2026.4.2</span>
                </div>
            </div>

            <div className="login-form-wrap">
                <form className="login-form" onSubmit={handleSubmit}>
                    <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Anmelden</h2>
                    <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 28 }}>
                        Wählen Sie Ihre Rolle und melden Sie sich mit Ihren Zugangsdaten an.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                        {[
                            { id: "arzt", label: "Zahnarzt / Zahnärztin", sub: "Voller Zugriff" },
                            { id: "assistenz", label: "ZFA / Assistenz", sub: "Behandlung & Termine" },
                            { id: "verwaltung", label: "Verwaltung", sub: "Abrechnung & Stammdaten" },
                        ].map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                className="login-role-chip"
                                aria-pressed={role === r.id}
                                onClick={() => setRole(r.id as typeof role)}
                            >
                                <div style={{ flex: 1, textAlign: "left" }}>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                                    <div style={{ fontSize: 11.5, color: "var(--fg-3)" }}>{r.sub}</div>
                                </div>
                                {role === r.id ? "✓" : null}
                            </button>
                        ))}
                    </div>
                    {error && (
                        <div role="alert" style={{ background: "var(--red-soft)", color: "var(--red)", padding: "12px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                            {error}
                        </div>
                    )}
                    <label htmlFor="email" style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>E-Mail</label>
                    <input id="email" className="input-edit" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ahmed@praxis.de" required style={{ marginBottom: 12 }} />
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                        <label htmlFor="passwort" style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", display: "block" }}>Passwort</label>
                        <button
                            type="button"
                            onClick={() => setHelperMsg("Passwort zurücksetzen: Bitte die Praxis-IT oder den Support kontaktieren. Selbstservice folgt mit der nächsten Lizenz-Stufe.")}
                            style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600 }}
                        >
                            Vergessen?
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
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 14, color: "var(--fg-3)", fontSize: 12.5 }}>
                        <label className="row" style={{ gap: 8 }}>
                            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                            Angemeldet bleiben (30 Tage)
                        </label>
                        <span>2FA aktiv</span>
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
                        onClick={() => setHelperMsg("Anmeldung mit HBA/eHB Karte: Stecken Sie die Karte ein und nutzen Sie bis dahin die Passwort-Anmeldung. Kartentreiber werden in einer späteren Ausbaustufe gebündelt.")}
                    >
                        Mit HBA-Karte anmelden
                    </button>
                    {helperMsg ? (
                        <div style={{ marginTop: 10, color: "var(--blue)", fontSize: 12.5 }}>{helperMsg}</div>
                    ) : null}
                    <div id="login-notfall-hinweis" style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-2)", marginBottom: 6 }}>{t("login.notfall.title")}</div>
                        <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.45 }}>{t("login.notfall.body")}</p>
                    </div>
                </form>
                {import.meta.env.DEV && (
                    <p style={{ textAlign: "center", color: "var(--fg-4)", fontSize: 12, marginTop: 16 }}>
                        Demo: ahmed@praxis.de / passwort123
                    </p>
                )}
            </div>
        </div>
    );
}
