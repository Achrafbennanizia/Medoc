import { INTERACTION_STANDARD } from "@/lib/interaction-standards";
import { useT } from "@/lib/i18n";

export type UserAccountMenuPlacement = "above" | "below";

type Props = {
    placement: UserAccountMenuPlacement;
    initials: string;
    name: string;
    emailFallback: string;
    logoutLabel: string;
    /** Label for the help entry (opens full Hilfe page). */
    helpNavLabel?: string;
    onRoleSwitch: () => void;
    onSettings: () => void;
    onShortcuts: () => void;
    onLogoutRequest: () => void;
};

export function UserAccountMenuDropdown({
    placement,
    initials,
    name,
    emailFallback,
    logoutLabel,
    helpNavLabel,
    onRoleSwitch,
    onSettings,
    onShortcuts,
    onLogoutRequest,
}: Props) {
    const t = useT();
    return (
        <div
            className={`menu-surface ${placement === "below" ? "menu-surface--below" : ""}`}
            style={{ minWidth: INTERACTION_STANDARD.dropdown.width, zIndex: INTERACTION_STANDARD.dropdown.zIndex }}
            role="menu"
        >
            <div className="menu-header">
                <div className="av av--accent" style={{ width: 34, height: 34, fontSize: 12 }}>{initials}</div>
                <div style={{ minWidth: 0 }}>
                    <p className="menu-title">{name}</p>
                    <p className="menu-subtitle">{emailFallback}</p>
                </div>
            </div>
            <div className="menu-label">{t("account.menu_section")}</div>
            <div className="menu-list">
                <button type="button" className="menu-item" role="menuitem" onClick={onRoleSwitch}>
                    {t("account.menu_role_switch")}
                </button>
            </div>
            <div className="menu-sep" />
            <div className="menu-list">
                <button type="button" className="menu-item" role="menuitem" onClick={onSettings}>
                    {t("nav.settings")}
                </button>
                <button type="button" className="menu-item" role="menuitem" onClick={onShortcuts}>
                    {helpNavLabel ?? t("account.menu_help")}
                </button>
                <button type="button" className="menu-item danger" role="menuitem" onClick={onLogoutRequest}>
                    {logoutLabel}
                </button>
            </div>
        </div>
    );
}