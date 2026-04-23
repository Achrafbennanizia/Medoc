import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Button } from "./button";

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
}

function collectFocusable(root: HTMLElement): HTMLElement[] {
    const sel =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return [...root.querySelectorAll<HTMLElement>(sel)].filter(
        (el) => !el.closest('[aria-hidden="true"]'),
    );
}

export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
    const titleId = useId();
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-surface-dim/80 backdrop-blur-sm animate-fade-in"
                aria-hidden="true"
                onClick={onClose}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                    "relative glass-bright rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in outline-none focus-ring",
                    className,
                )}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 id={titleId} className="text-title text-on-primary">
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className="text-on-surface-variant hover:text-on-surface transition-colors p-1 rounded-md hover:bg-surface-container focus-ring"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
                <div className="space-y-4">{children}</div>
                {footer && (
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-surface-container">
                        {footer}
                    </div>
                )}
            </div>
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
    danger?: boolean;
    loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Bestätigen", danger, loading }: ConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <p className="text-body text-on-surface">{message}</p>
        </Dialog>
    );
}
