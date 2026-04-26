import { INTERACTION_STANDARD } from "@/lib/interaction-standards";

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
    helpNavLabel = "Hilfe & Kurzbefehle",
    onRoleSwitch,
    onSettings,
    onShortcuts,
    onLogoutRequest,
}: Props) {
    return (
        <div
            className={`menu-surface ${placement === "below" ? "menu-surface--below" : ""}`}
            style={{ minWidth: INTERACTION_STANDARD.dropdown.width, zIndex: INTERACTION_STANDARD.dropdown.zIndex }}
            role="menu"
        >
            <div className="menu-header">
                <div className="av" style={{ width: 34, height: 34, fontSize: 12, background: "linear-gradient(135deg,#B6E7DA,#0EA07E)" }}>{initials}</div>
                <div style={{ minWidth: 0 }}>
                    <p className="menu-title">{name}</p>
                    <p className="menu-subtitle">{emailFallback}</p>
                </div>
            </div>
            <div className="menu-label">Konto</div>
            <div className="menu-list">
                <button type="button" className="menu-item" role="menuitem" onClick={onRoleSwitch}>
                    Mit anderer Rolle anmelden…
                </button>
            </div>
            <div className="menu-sep" />
            <div className="menu-list">
                <button type="button" className="menu-item" role="menuitem" onClick={onSettings}>
                    Einstellungen
                </button>
                <button type="button" className="menu-item" role="menuitem" onClick={onShortcuts}>
                    {helpNavLabel}
                </button>
                <button type="button" className="menu-item danger" role="menuitem" onClick={onLogoutRequest}>
                    {logoutLabel}
                </button>
            </div>
        </div>
    );
}
