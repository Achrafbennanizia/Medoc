import { useEffect, type RefObject } from "react";

interface UseDismissibleLayerOptions {
    open: boolean;
    rootRef: RefObject<HTMLElement | null>;
    onDismiss: () => void;
}

/**
 * Shared overlay behavior standard:
 * close on outside pointer and Escape.
 */
export function useDismissibleLayer({ open, rootRef, onDismiss }: UseDismissibleLayerOptions) {
    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            const root = rootRef.current;
            if (!root) return;
            if (!root.contains(event.target as Node)) onDismiss();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onDismiss();
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open, rootRef, onDismiss]);
}
