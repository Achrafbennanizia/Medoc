import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, postLoginPath } from "@/systems/practice-host/controllers/auth.controller";
import { BREAK_GLASS_ENABLED } from "@/lib/mvp-security-config";
import { CapsLockIcon, EyeIcon, EyeOffIcon, ICON_SIZE_LG, ICON_SIZE_SM, PinIcon } from "@/lib/icons";
import { useT } from "@/lib/i18n";
import { LocaleSwitcher } from "../components/locale-switcher";
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

function formatLoginError(err: unknown, rateLimitedMsg: string, failedMsg: string): string {
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
        return failedMsg;
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
    const desktopChrome = useDesktopChromeMode();
    const isMacOverlay = desktopChrome === "mac-overlay";
    const handleMacWindowDrag = useMacWindowDrag(isMacOverlay);

    const deviceOpts = {
        device_label: typeof window !== "undefined" ? `MeDoc · ${window.location.hostname || "app"}` : "MeDoc",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setHelperMsg("");
        setLoading(true);
        try {
            const session = await login(email, passwort, deviceOpts);
            persistRememberMe(rememberMe, email);
            navigate(await postLoginPath(session));
        } catch (err) {
            setError(formatLoginError(err, t("login.rate_limited"), t("login.failed")));
        } finally {
            setLoading(false);
        }
    };

    const syncCapsLock = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
        if ("getModifierState" in e && typeof e.getModifierState === "function") {
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
                    aria-label={t("login.window_drag_aria")}
                >
                    <span className="login-window-chrome__hint" aria-hidden>
                        {t("login.brand")}
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
                    <div className="login-brand-row row">
                        <div className="login-brand-mark" aria-hidden>
                            <PinIcon size={ICON_SIZE_LG} />
                        </div>
                        <div className="login-brand-text">
                            {t("login.brand")}{" "}
                            <span className="login-brand-text__sub">{t("login.brand_subtitle")}</span>
                        </div>
                    </div>
                    <div style={{ marginTop: 48 }}>
                        <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 14px", maxWidth: 460, lineHeight: 1.05 }}>
                            {t("login.hero_title")}
                        </h1>
                        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", maxWidth: 460, lineHeight: 1.55 }}>
                            {t("login.hero_subtitle")}
                        </p>
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", maxWidth: 460, lineHeight: 1.5, marginTop: 16 }}>
                            {t("login.trust_line")}
                        </p>
                    </div>
                </div>
                <div style={{ position: "relative", zIndex: 1, fontSize: 12.5, color: "rgba(255,255,255,0.55)", display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <span>
                        {t("login.build")} {import.meta.env.VITE_APP_VERSION ?? "—"}
                        {import.meta.env.DEV ? ` · ${import.meta.env.MODE}` : ""}
                    </span>
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
                            {t("auth.login")}
                        </h2>
                        {import.meta.env.DEV ? (
                            <span
                                className="pill solid-amber"
                                title={t("login.dev_badge_title")}
                                style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}
                            >
                                {t("login.dev_badge")}
                            </span>
                        ) : null}
                    </div>
                    <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 28 }}>
                        {t("login.role_hint")}
                    </p>
                    {error && (
                        <div role="alert" style={{ background: "var(--red-soft)", color: "var(--red)", padding: "12px", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
                            {error}
                        </div>
                    )}
                    <label htmlFor="email" className="form-label">{t("auth.email")}</label>
                    <input id="email" className="input-edit" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@praxis.de" required autoComplete="username" style={{ marginBottom: 12 }} />
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                        <label htmlFor="passwort" className="form-label form-label--mb-0">{t("auth.password")}</label>
                        <button
                            type="button"
                            aria-describedby="login-password-help"
                            onClick={() => setHelperMsg(t("login.password_reset_hint"))}
                            style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600 }}
                        >
                            {t("login.password_forgot")}
                        </button>
                    </div>
                    <div className="input login-password-input-row" style={{ marginBottom: 8 }}>
                        <input
                            id="passwort"
                            className="input-edit login-password-input-row__field"
                            type={showPw ? "text" : "password"}
                            value={passwort}
                            onChange={(e) => setPasswort(e.target.value)}
                            onFocus={syncCapsLock}
                            onKeyDown={syncCapsLock}
                            onKeyUp={syncCapsLock}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                        {capsOn ? (
                            <span
                                className="login-password-caps"
                                role="img"
                                aria-label={t("login.caps_warning")}
                                title={t("login.caps_warning")}
                            >
                                <CapsLockIcon size={ICON_SIZE_SM} />
                            </span>
                        ) : null}
                        <button
                            type="button"
                            className="icon-btn login-password-toggle"
                            aria-label={showPw ? t("login.pw_toggle_hide") : t("login.pw_toggle_show")}
                            onClick={() => setShowPw((v) => !v)}
                        >
                            {showPw ? <EyeOffIcon size={ICON_SIZE_SM} /> : <EyeIcon size={ICON_SIZE_SM} />}
                        </button>
                    </div>
                    {capsOn ? (
                        <p role="status" style={{ color: "var(--orange)", fontSize: 12.5, fontWeight: 600, margin: "0 0 12px" }}>
                            {t("login.caps_warning")}
                        </p>
                    ) : null}
                    <div className="row login-remember-row">
                        <label className="login-remember-label">
                            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                            {t("login.remember_email")}
                        </label>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)", marginBottom: 8 }}>{t("login.language_label")}</div>
                        <LocaleSwitcher />
                    </div>
                    <button type="submit" className="login-submit" disabled={loading}>
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
                        {t("auth.login")}
                    </button>
                    <p id="login-password-help" className="sr-only">
                        {t("login.cert_hint_sr")}
                    </p>
                    {helperMsg ? (
                        <div style={{ marginTop: 10, color: "var(--blue)", fontSize: 12.5 }} role="status">{helperMsg}</div>
                    ) : null}
                    {BREAK_GLASS_ENABLED ? (
                    <div id="login-notfall-hinweis" style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-2)", marginBottom: 6 }}>{t("login.notfall.title")}</div>
                        <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.45 }}>{t("login.notfall.body")}</p>
                    </div>
                    ) : null}
                </form>
                {import.meta.env.DEV && (
                    <p style={{ textAlign: "center", color: "var(--fg-3)", fontSize: 12, marginTop: 14, maxWidth: 420, marginInlineStart: "auto", marginInlineEnd: "auto", lineHeight: 1.45 }}>
                        <strong>{t("login.dev_badge")}:</strong> {t("login.dev_db_hint")}
                    </p>
                )}
            </div>
            </div>
        </div>
    );
}

/*
 * TODO(deferred-security): 2FA login flow unwired — re-enable with TOTP_2FA_ENABLED.
 * See docs/coordination/todos-deferred-security-features.md and totp.controller.ts.
 */
