import { useEffect, type RefObject } from "react";

interface UseDismissibleLayerOptions {
    open: boolean;
    rootRef: RefObject<HTMLElement | null>;
    /** Hits inside these roots count as inside (e.g. menus rendered via portal). */
    containRefs?: readonly RefObject<HTMLElement | null>[];
    onDismiss: () => void;
}

/**
 * Shared overlay behavior: close on outside pointer (touch / pen / mouse, capture) and Escape.
 */
export function useDismissibleLayer({ open, rootRef, containRefs, onDismiss }: UseDismissibleLayerOptions) {
    useEffect(() => {
        if (!open) return;

        const insideAny = (target: Node) => {
            const root = rootRef.current;
            if (root?.contains(target)) return true;
            if (containRefs) {
                for (const r of containRefs) {
                    if (r.current?.contains(target)) return true;
                }
            }
            return false;
        };

        const onPointerDown = (event: PointerEvent) => {
            if (!insideAny(event.target as Node)) onDismiss();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onDismiss();
        };

        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open, rootRef, containRefs, onDismiss]);
}
