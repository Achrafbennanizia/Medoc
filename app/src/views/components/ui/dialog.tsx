import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { Button } from "./button";

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
    /** Visible title element id for `aria-labelledby` when `presentation="centered"`. */
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
    const t = useT();

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
                onClose();
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
    }, [open, onClose]);

    if (!open) return null;

    const closeLabel = t("a11y.close_dialog");

    const layer = (
        <div className="modal-backdrop" onClick={onClose} role="presentation">
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={isCentered ? labelledBy ?? undefined : titleId}
                aria-label={isCentered && !labelledBy ? (title || undefined) : undefined}
                tabIndex={-1}
                className={`modal ${isCentered ? "modal--centered" : ""} ${className ?? ""}`}
                onClick={(e) => e.stopPropagation()}
            >
                {isCentered ? (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className="icon-btn modal-close-corner"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid var(--line)", gap: 12 }}>
                        <h3 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                            {title}
                        </h3>
                        <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {headerExtra}
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label={closeLabel}
                                className="icon-btn"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
                <div style={isCentered ? { padding: 0 } : { padding: "16px 20px" }}>{children}</div>
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

/* ── Confirm Dialog shorthand ── */
interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Bestätigen", danger, loading }: ConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title=""
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <button className={danger ? "destructive" : "primary"} onClick={onConfirm} disabled={loading}>
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <div className="confirm-body">
                {danger ? (
                    <div className="confirm-icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M7.5 5.8a9 9 0 1 0 9 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    </div>
                ) : null}
                <h3 className="confirm-title">{title}</h3>
                <p className="confirm-text">{message}</p>
            </div>
        </Dialog>
    );
}
