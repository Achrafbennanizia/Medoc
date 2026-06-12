import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { emitWorkflowEvent } from "@/lib/workflow-events";

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    /** Zusätzliche Steuerung neben dem Schließen-Button (z.B. "Bearbeiten"). */
    headerExtra?: ReactNode;
    className?: string;
    /** Card-style dialog: no top title bar; close control in corner (use with `modal-body` + `modal-actions` in children/footer). */
    presentation?: "default" | "centered";
    /** Optional visible title id for `aria-labelledby` (centered mode, or default mode when the top bar is hidden). */
    labelledBy?: string;
}

function collectFocusable(root: HTMLElement): HTMLElement[] {
    const sel =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return [...root.querySelectorAll<HTMLElement>(sel)].filter(
        (el) => !el.closest('[aria-hidden="true"]'),
    );
}

export function Dialog({ open, onClose, title, children, footer, headerExtra, className, presentation = "default", labelledBy }: DialogProps) {
    const titleId = useId();
    const isCentered = presentation === "centered";
    const panelRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const t = useT();
    const reportCancel = (action: string) => {
        emitWorkflowEvent({
            workflow: "dialog",
            step: "cancel",
            action,
        });
    };

    useEffect(() => {
        if (!open) return;

        const root = panelRef.current;
        if (!root) return;

        const prevActive = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKeyDownCapture = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                reportCancel("escape_key");
                onCloseRef.current();
                return;
            }
            if (e.key !== "Tab") return;

            const nodes = collectFocusable(root);
            if (nodes.length === 0) {
                e.preventDefault();
                root.focus();
                return;
            }

            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            const active = document.activeElement;

            if (!root.contains(active)) {
                e.preventDefault();
                first.focus();
                return;
            }

            if (nodes.length === 1) {
                e.preventDefault();
                first.focus();
                return;
            }

            if (e.shiftKey) {
                if (active === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDownCapture, true);

        queueMicrotask(() => {
            const nodes = collectFocusable(root);
            if (nodes.length > 0) {
                nodes[0].focus();
            } else {
                root.focus();
            }
        });

        return () => {
            document.removeEventListener("keydown", onKeyDownCapture, true);
            document.body.style.overflow = prevOverflow;
            prevActive?.focus?.({ preventScroll: true });
        };
    }, [open]);

    if (!open) return null;

    const closeLabel = t("a11y.close_dialog");
    const titleTrimmed = title.trim();
    const showDefaultHeader = !isCentered && (titleTrimmed.length > 0 || headerExtra != null);

    const ariaLabelledBy = (() => {
        if (isCentered) {
            if (labelledBy) return labelledBy;
            if (titleTrimmed) return titleId;
            return undefined;
        }
        if (showDefaultHeader) return titleId;
        return labelledBy;
    })();

    const ariaLabel = !ariaLabelledBy && !titleTrimmed ? t("a11y.dialog_heading_fallback") : undefined;

    const layer = (
        <div
            className="modal-backdrop"
            onClick={() => {
                reportCancel("backdrop_click");
                onClose();
            }}
            role="presentation"
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={ariaLabelledBy}
                aria-label={ariaLabel}
                tabIndex={-1}
                className={`modal ${isCentered ? "modal--centered" : ""} ${className ?? ""}`}
                onClick={(e) => e.stopPropagation()}
            >
                {isCentered ? (
                    <button
                        type="button"
                        onClick={() => {
                            reportCancel("close_button");
                            onClose();
                        }}
                        aria-label={closeLabel}
                        className="icon-btn modal-close-corner"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                ) : showDefaultHeader ? (
                    <div className="modal-header-row">
                        <h2
                            id={titleId}
                            className={`modal-title${!titleTrimmed ? " sr-only" : ""}`}
                        >
                            {titleTrimmed ? title : t("a11y.dialog_heading_fallback")}
                        </h2>
                        <div className="modal-header-actions row">
                            {headerExtra}
                            <button
                                type="button"
                                onClick={() => {
                                    reportCancel("close_button");
                                    onClose();
                                }}
                                aria-label={closeLabel}
                                className="icon-btn"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ) : null}
                <div className={isCentered ? "modal-body-pad modal-body-pad--flush" : "modal-body-pad"}>
                    {isCentered && titleTrimmed && !labelledBy ? (
                        <h2 id={titleId} className="sr-only">
                            {title}
                        </h2>
                    ) : null}
                    {children}
                </div>
                {footer && (
                    <div className="modal-actions">{footer}</div>
                )}
            </div>
        </div>
    );

    if (typeof document !== "undefined") {
        return createPortal(layer, document.body);
    }
    return layer;
}

/* ── iOS-style alert actions (shared by ConfirmDialog & custom Dialogs) ── */
export type IosConfirmActionsProps = {
    cancelLabel?: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
    disabled?: boolean;
    loading?: boolean;
    /** Primary label color: red (destructive) vs system blue */
    destructive?: boolean;
};

export function IosConfirmActions({
    cancelLabel = "Abbrechen",
    confirmLabel,
    onCancel,
    onConfirm,
    disabled = false,
    loading = false,
    destructive = false,
}: IosConfirmActionsProps) {
    const busy = disabled || loading;
    return (
        <div className="ios-confirm-actions" role="group" aria-label="Aktionen">
            <button
                type="button"
                className="ios-confirm-btn ios-confirm-btn--cancel"
                onClick={() => {
                    emitWorkflowEvent({
                        workflow: "dialog",
                        step: "cancel",
                        action: "cancel_button",
                    });
                    onCancel();
                }}
                disabled={busy}
            >
                {cancelLabel}
            </button>
            <span className="ios-confirm-actions__vsep" aria-hidden="true" />
            <button
                type="button"
                className={`ios-confirm-btn ios-confirm-btn--primary${destructive ? " ios-confirm-btn--destructive" : ""}`}
                onClick={onConfirm}
                disabled={busy}
            >
                {loading ? "…" : confirmLabel}
            </button>
        </div>
    );
}

/* ── Confirm Dialog shorthand ── */
interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Prefer red primary label (still sheet layout; rare — most delete flows use blue like iOS default actions). */
    danger?: boolean;
    loading?: boolean;
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Bestätigen",
    cancelLabel = "Abbrechen",
    danger = false,
    loading = false,
}: ConfirmDialogProps) {
    const confirmTitleId = useId();
    const handleClose = () => {
        if (!loading) onClose();
    };
    return (
        <Dialog
            open={open}
            onClose={handleClose}
            title=""
            labelledBy={confirmTitleId}
            className="modal--ios-confirm"
        >
            <div className="ios-confirm">
                <div className="ios-confirm-body">
                    <h2 id={confirmTitleId} className="ios-confirm-title">
                        {title}
                    </h2>
                    <p className="ios-confirm-message">{message}</p>
                </div>
                <IosConfirmActions
                    cancelLabel={cancelLabel}
                    confirmLabel={confirmLabel}
                    onCancel={handleClose}
                    onConfirm={onConfirm}
                    loading={loading}
                    destructive={danger}
                />
            </div>
        </Dialog>
    );
}
