import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { ConfirmDialog, Dialog, IosConfirmActions } from "./ui/dialog";
import { Button } from "./ui/button";
import { useUiPreferencesStore } from "@/models/store/ui-preferences-store";
import {
    resolveConfirmationPresentation,
    type ConfirmationAreaKey,
    type ConfirmationPresentMode,
} from "@/lib/confirmation-preferences";

export type ChartInlineConfirmProps = {
    id: string;
    title: string;
    message: ReactNode;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
    danger?: boolean;
    loading?: boolean;
};

export function ChartInlineConfirm({
    id,
    title,
    message,
    onCancel,
    onConfirm,
    confirmLabel,
    danger,
    loading,
}: ChartInlineConfirmProps) {
    const t = useT();
    return (
        <div
            id={id}
            className={`chart-inline-panel${danger ? " chart-inline-panel--danger" : ""}`}
            role="alertdialog"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-desc`}
        >
            <div className="chart-inline-panel-head">
                <div>
                    <div id={`${id}-title`} className="chart-inline-panel-title">
                        {title}
                    </div>
                    <div id={`${id}-desc`} className="chart-inline-panel-sub">
                        {message}
                    </div>
                </div>
            </div>
            <div className="chart-inline-panel-actions chart-inline-panel-actions--ios">
                <IosConfirmActions
                    cancelLabel={t("common.cancel")}
                    confirmLabel={confirmLabel ?? t("common.confirm")}
                    onCancel={onCancel}
                    onConfirm={onConfirm}
                    loading={loading}
                />
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
        <ChartInlineConfirm
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

export type ChartInlineEditPanelShellProps = {
    id: string;
    ariaLabel: string;
    title: string;
    subtitle?: ReactNode;
    headerExtra?: ReactNode;
    onClose: () => void;
    footer?: ReactNode;
    children: ReactNode;
    panelVariant?: "default" | "prescription";
    /** Appended to root panel classes (e.g. table-embedded editors). */
    rootClassName?: string;
};

/** Shared chrome for inline Chart edit panels (also embeddable inside layouts such as table rows). */
export function ChartInlineEditPanelShell({
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
}: ChartInlineEditPanelShellProps) {
    const t = useT();
    const root = panelVariant === "prescription" ? "prescription-chart-panel" : "chart-inline-panel";
    const head = panelVariant === "prescription" ? "prescription-chart-panel-head" : "chart-inline-panel-head";
    const tcls = panelVariant === "prescription" ? "prescription-chart-panel-title" : "chart-inline-panel-title";
    const scls = panelVariant === "prescription" ? "prescription-chart-panel-sub" : "chart-inline-panel-sub";
    const body = panelVariant === "prescription" ? "prescription-chart-panel-body" : "chart-inline-panel-body";
    const act = panelVariant === "prescription" ? "prescription-chart-panel-actions" : "chart-inline-panel-actions";

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
                        {t("common.close")}
                    </Button>
                </div>
            </div>
            <div className={body}>{children}</div>
            {footer != null ? <div className={act}>{footer}</div> : null}
        </div>
    );
}

export type ChartEditFormOrInlineProps = {
    area: ConfirmationAreaKey;
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    inlineId: string;
    ariaLabel: string;
    /** Use `prescription` to match Prescription-assistant panel styling when inline. */
    panelVariant?: "default" | "prescription";
    /** Omit when the child provides its own actions (e.g. ExaminationComposer). */
    footer?: ReactNode;
    /** Extra classes on the modal root (e.g. wider Examination editor). */
    dialogClassName?: string;
    /** When set, ignores KV preferences so Chart-Processing always opens as Dialog or inline. */
    presentationOverride?: ConfirmationPresentMode;
    /** Extra actions in the header (e.g. "Edit" in view mode). */
    headerExtra?: ReactNode;
    children: ReactNode;
};

/**
 * Edit forms in the patient file: modal dialog or inline panel, same preference keys as delete confirms.
 */
export function ChartEditFormOrInline({
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
}: ChartEditFormOrInlineProps) {
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
                className={["chart-form-dialog", dialogClassName].filter(Boolean).join(" ")}
                footer={footer ?? undefined}
                headerExtra={headerExtra}
            >
                {subtitle ? <p className="chart-form-dialog-sub">{subtitle}</p> : null}
                <div className="chart-form-dialog-body">{children}</div>
            </Dialog>
        );
    }

    return (
        <ChartInlineEditPanelShell
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
        </ChartInlineEditPanelShell>
    );
}