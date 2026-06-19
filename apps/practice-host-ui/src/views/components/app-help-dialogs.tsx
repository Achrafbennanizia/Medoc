import { useT } from "@/lib/i18n";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";

type AboutProps = {
    open: boolean;
    onClose: () => void;
    appVersion?: string;
};

export function AboutAppDialog({ open, onClose, appVersion = "0.1.0" }: AboutProps) {
    const t = useT();
    return (
        <Dialog open={open} onClose={onClose} title={t("app.help.about_title")}>
            <div style={{ textAlign: "left" }}>
                <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>{t("app.help.about_product")}</p>
                <p style={{ color: "var(--fg-3)", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 16px" }}>
                    {t("app.help.about_description")}
                </p>
                <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>
                    {t("app.help.about_version")} <span className="font-mono">{appVersion}</span>
                </p>
                <p style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, margin: "12px 0 0" }}>
                    {t("app.help.about_symbols")}{" "}
                    <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                        Lucide
                    </a>{" "}
                    {t("app.help.about_symbols_license")}
                </p>
            </div>
        </Dialog>
    );
}

type RoleSwitchProps = {
    open: boolean;
    onClose: () => void;
    onConfirmLogout: () => void;
};

/** Honest UX: roles are bound at login; switching requires re-authentication. */
export function RoleSwitchDialog({ open, onClose, onConfirmLogout }: RoleSwitchProps) {
    const t = useT();
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t("app.help.role_switch_title")}
            footer={
                <>
                    <Button variant="ghost" style={{ flex: 1 }} onClick={onClose}>
                        {t("common.cancel")}
                    </Button>
                    <Button style={{ flex: 1 }} onClick={onConfirmLogout}>
                        {t("auth.logout")}
                    </Button>
                </>
            }
        >
            <p style={{ color: "var(--fg-3)", fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                {t("app.help.role_switch_body")}
            </p>
        </Dialog>
    );
}
