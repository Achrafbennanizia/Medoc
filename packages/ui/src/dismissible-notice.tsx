import { useCallback, useState, type ReactNode } from "react";
import { XIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { IconButton } from "./icon-button";

export type DismissibleNoticeVariant = "info" | "warning" | "error" | "accent";

const STORAGE_PREFIX = "medoc-notice-dismiss:";

function readDismissed(key: string): boolean {
    try {
        return sessionStorage.getItem(`${STORAGE_PREFIX}${key}`) === "1";
    } catch {
        return false;
    }
}

function writeDismissed(key: string): void {
    try {
        sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, "1");
    } catch {
        /* ignore */
    }
}

export type DismissibleNoticeProps = {
    title?: ReactNode;
    subtitle?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
    variant?: DismissibleNoticeVariant;
    role?: "status" | "alert" | "region";
    ariaLabel?: string;
    /** When set, dismissal is remembered for this browser tab session. */
    dismissKey?: string;
    closable?: boolean;
    onDismiss?: () => void;
    className?: string;
};

export function DismissibleNotice({
    title,
    subtitle,
    children,
    actions,
    variant = "info",
    role = "status",
    ariaLabel,
    dismissKey,
    closable = true,
    onDismiss,
    className,
}: DismissibleNoticeProps) {
    const t = useT();
    const [visible, setVisible] = useState(() => !dismissKey || !readDismissed(dismissKey));

    const dismiss = useCallback(() => {
        if (dismissKey) writeDismissed(dismissKey);
        setVisible(false);
        onDismiss?.();
    }, [dismissKey, onDismiss]);

    if (!visible) return null;

    const labelledBy = title ? "app-notice-title" : undefined;

    return (
        <div
            role={role}
            aria-label={ariaLabel}
            aria-labelledby={labelledBy}
            className={cn("app-notice", `app-notice--${variant}`, className)}
        >
            <div className="app-notice__head">
                <div className="app-notice__head-text">
                    {title ? (
                        <div id="app-notice-title" className="app-notice__title">
                            {title}
                        </div>
                    ) : null}
                    {subtitle ? <div className="app-notice__subtitle">{subtitle}</div> : null}
                </div>
                {closable ? (
                    <IconButton type="button" className="app-notice__close" aria-label={t("a11y.close")} onClick={dismiss}>
                        <XIcon size={16} />
                    </IconButton>
                ) : null}
            </div>
            {children ? <div className="app-notice__body">{children}</div> : null}
            {actions ? <div className="app-notice__actions">{actions}</div> : null}
        </div>
    );
}
