import type { ReactNode } from "react";
import { ConfirmDialog, Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { useUiPreferencesStore } from "@/models/store/ui-preferences-store";
import {
    resolveConfirmationPresentation,
    type ConfirmationAreaKey,
    type ConfirmationPresentMode,
} from "@/lib/confirmation-preferences";

export type AkteInlineConfirmProps = {
    id: string;
    title: string;
    message: ReactNode;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    danger?: boolean;
    loading?: boolean;
};

export function AkteInlineConfirm({
    id,
    title,
    message,
    onCancel,
    onConfirm,
    confirmLabel = "Bestätigen",
    danger,
    loading,
}: AkteInlineConfirmProps) {
    return (
        <div
            id={id}
            className={`akte-inline-panel${danger ? " akte-inline-panel--danger" : ""}`}
            role="alertdialog"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-desc`}
        >
            <div className="akte-inline-panel-head">
                <div>
                    <div id={`${id}-title`} className="akte-inline-panel-title">
                        {title}
                    </div>
                    <div id={`${id}-desc`} className="akte-inline-panel-sub">
                        {message}
                    </div>
                </div>
            </div>
            <div className="akte-inline-panel-actions">
                <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
                    Abbrechen
                </Button>
                <Button type="button" variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
                    {confirmLabel}
                </Button>
            </div>
        </div>
    );
}

export type ConfirmOrInlineProps = {
    area: ConfirmationAreaKey;
    open: boolean;
    inlineId: string;
    title: string;
    message: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    danger?: boolean;
    loading?: boolean;
};

/**
 * Renders either a modal confirm (default) or an inline panel, per {@link useUiPreferencesStore}.
 */
export function ConfirmOrInline({
    area,
    open,
    inlineId,
    title,
    message,
    onCancel,
    onConfirm,
    confirmLabel,
    danger,
    loading,
}: ConfirmOrInlineProps) {
    const confirmations = useUiPreferencesStore((s) => s.confirmations);
    const mode = resolveConfirmationPresentation(confirmations, area);

    if (!open) return null;

    if (mode === "modal") {
        return (
            <ConfirmDialog
                open={open}
                onClose={onCancel}
                onConfirm={onConfirm}
                title={title}
                message={message}
                confirmLabel={confirmLabel}
                danger={danger}
                loading={loading}
            />
        );
    }

    return (
        <AkteInlineConfirm
            id={inlineId}
            title={title}
            message={message}
            onCancel={onCancel}
            onConfirm={onConfirm}
            confirmLabel={confirmLabel}
            danger={danger}
            loading={loading}
        />
    );
}

export type AkteInlineEditPanelShellProps = {
    id: string;
    ariaLabel: string;
    title: string;
    subtitle?: ReactNode;
    headerExtra?: ReactNode;
    onClose: () => void;
    footer?: ReactNode;
    children: ReactNode;
    panelVariant?: "default" | "rezept";
    /** Appended to root panel classes (e.g. table-embedded editors). */
    rootClassName?: string;
};

/** Shared chrome for inline Akte edit panels (also embeddable inside layouts such as table rows). */
export function AkteInlineEditPanelShell({
    id,
    ariaLabel,
    title,
    subtitle,
    headerExtra,
    onClose,
    footer,
    children,
    panelVariant = "default",
    rootClassName,
}: AkteInlineEditPanelShellProps) {
    const root = panelVariant === "rezept" ? "rezept-akte-panel" : "akte-inline-panel";
    const head = panelVariant === "rezept" ? "rezept-akte-panel-head" : "akte-inline-panel-head";
    const tcls = panelVariant === "rezept" ? "rezept-akte-panel-title" : "akte-inline-panel-title";
    const scls = panelVariant === "rezept" ? "rezept-akte-panel-sub" : "akte-inline-panel-sub";
    const body = panelVariant === "rezept" ? "rezept-akte-panel-body" : "akte-inline-panel-body";
    const act = panelVariant === "rezept" ? "rezept-akte-panel-actions" : "akte-inline-panel-actions";

    return (
        <div
            id={id}
            className={[root, rootClassName].filter(Boolean).join(" ")}
            role="region"
            aria-label={ariaLabel}
        >
            <div className={head}>
                <div>
                    <div className={tcls}>{title}</div>
                    {subtitle ? <div className={scls}>{subtitle}</div> : null}
                </div>
                <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {headerExtra}
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                        Schließen
                    </Button>
                </div>
            </div>
            <div className={body}>{children}</div>
            {footer != null ? <div className={act}>{footer}</div> : null}
        </div>
    );
}

export type AkteEditFormOrInlineProps = {
    area: ConfirmationAreaKey;
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    inlineId: string;
    ariaLabel: string;
    /** Use `rezept` to match Rezept-assistant panel styling when inline. */
    panelVariant?: "default" | "rezept";
    /** Omit when the child provides its own actions (e.g. UntersuchungComposer). */
    footer?: ReactNode;
    /** Extra classes on the modal root (e.g. wider Untersuchung editor). */
    dialogClassName?: string;
    /** When set, ignores KV preferences so Akte-Bearbeitung always opens as Dialog or inline. */
    presentationOverride?: ConfirmationPresentMode;
    /** Zusätzliche Aktionen in der Kopfzeile (z.B. "Bearbeiten" bei Ansichtsmodus). */
    headerExtra?: ReactNode;
    children: ReactNode;
};

/**
 * Edit forms in the patient file: modal dialog or inline panel, same preference keys as delete confirms.
 */
export function AkteEditFormOrInline({
    area,
    open,
    onClose,
    title,
    subtitle,
    inlineId,
    ariaLabel,
    panelVariant = "default",
    footer,
    dialogClassName,
    presentationOverride,
    headerExtra,
    children,
}: AkteEditFormOrInlineProps) {
    const confirmations = useUiPreferencesStore((s) => s.confirmations);
    const mode =
        presentationOverride ?? resolveConfirmationPresentation(confirmations, area);

    if (!open) return null;

    if (mode === "modal") {
        return (
            <Dialog
                open={open}
                onClose={onClose}
                title={title}
                className={["akte-form-dialog", dialogClassName].filter(Boolean).join(" ")}
                footer={footer ?? undefined}
                headerExtra={headerExtra}
            >
                {subtitle ? <p className="akte-form-dialog-sub">{subtitle}</p> : null}
                <div className="akte-form-dialog-body">{children}</div>
            </Dialog>
        );
    }

    return (
        <AkteInlineEditPanelShell
            id={inlineId}
            ariaLabel={ariaLabel}
            title={title}
            subtitle={subtitle}
            headerExtra={headerExtra}
            onClose={onClose}
            footer={footer}
            panelVariant={panelVariant}
        >
            {children}
        </AkteInlineEditPanelShell>
    );
}
