"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function collectFocusable(root: HTMLElement): HTMLElement[] {
    const sel =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return [...root.querySelectorAll<HTMLElement>(sel)].filter(
        (el) => !el.closest('[aria-hidden="true"]'),
    );
}

export interface DialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    /** Extra classes for the panel (e.g. max-w-md) */
    className?: string;
}

export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;

        const root = panelRef.current;
        if (!root) return;

        const prevActive = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        queueMicrotask(() => {
            root.focus();
        });

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            const nodes = collectFocusable(root);
            if (nodes.length === 0) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (nodes.length === 1) {
                e.preventDefault();
                first.focus();
                return;
            }
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        root.addEventListener("keydown", onKeyDown);
        return () => {
            root.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
            prevActive?.focus?.();
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                    "relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-lg outline-none",
                    "focus-visible:ring-2 focus-visible:ring-blue-500/40",
                    className,
                )}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 id={titleId} className="text-lg font-semibold text-gray-900">
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Schließen"
                        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="h-5 w-5" aria-hidden />
                    </button>
                </div>
                <div className="space-y-4">{children}</div>
                {footer ? (
                    <div className="mt-6 flex justify-end gap-2 border-t border-gray-200 pt-4">{footer}</div>
                ) : null}
            </div>
        </div>
    );
}

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: "danger" | "default";
}

export function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Bestätigen",
    onConfirm,
    onCancel,
    variant = "default",
}: ConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            title={title}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                    >
                        Abbrechen
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={cn(
                            "rounded-lg px-4 py-2 text-sm font-medium text-white",
                            variant === "danger"
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-blue-600 hover:bg-blue-700",
                        )}
                    >
                        {confirmLabel}
                    </button>
                </>
            }
            className="max-w-md"
        >
            <p className="text-sm text-gray-600">{message}</p>
        </Dialog>
    );
}
