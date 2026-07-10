import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreIcon } from "@/lib/icons";
import { useDismissibleLayer } from "./ui/use-dismissible-layer";

export type ZahlRowAction = {
    id: string;
    label: ReactNode;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
};

const MENU_WIDTH = 168;
const MENU_ROW_H = 36;
const MENU_PAD = 10;
const VIEWPORT_PAD = 8;
const MENU_Z = 10050;

function computeMenuStyle(trigger: HTMLElement, actionCount: number): CSSProperties {
    const rect = trigger.getBoundingClientRect();
    const menuHeight = actionCount * MENU_ROW_H + MENU_PAD;
    const rtl = getComputedStyle(document.documentElement).direction === "rtl";
    let left = rtl ? rect.left : rect.right - MENU_WIDTH;
    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - VIEWPORT_PAD - MENU_WIDTH));
    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - VIEWPORT_PAD) {
        top = rect.top - menuHeight - 6;
    }
    top = Math.max(VIEWPORT_PAD, top);
    return {
        position: "fixed",
        top,
        left,
        width: MENU_WIDTH,
        zIndex: MENU_Z,
    };
}

export function ZahlRowActionsMenu({
    actions,
    ariaLabel,
}: {
    actions: ZahlRowAction[];
    ariaLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const [portalStyle, setPortalStyle] = useState<CSSProperties | undefined>();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuPortalRef = useRef<HTMLDivElement>(null);

    const closeMenu = useCallback(() => {
        setOpen(false);
        setPortalStyle(undefined);
    }, []);

    useDismissibleLayer({
        open,
        rootRef,
        containRefs: [menuPortalRef],
        onDismiss: closeMenu,
    });

    useLayoutEffect(() => {
        if (!open) {
            setPortalStyle(undefined);
            return;
        }
        const update = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            setPortalStyle(computeMenuStyle(trigger, actions.length));
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open, actions.length]);

    if (actions.length === 0) return null;

    const onTriggerClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (open) {
            closeMenu();
            return;
        }
        const trigger = triggerRef.current;
        if (trigger) {
            setPortalStyle(computeMenuStyle(trigger, actions.length));
        }
        setOpen(true);
    };

    const menuNode =
        open && portalStyle ? (
            <div ref={menuPortalRef}>
                <div
                    className="zahl-row-actions-menu__panel zahl-row-actions-menu__panel--portal"
                    style={portalStyle}
                    role="menu"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="menu-list">
                        {actions.map((action) => (
                            <button
                                key={action.id}
                                type="button"
                                role="menuitem"
                                className={["menu-item", action.danger ? "danger" : ""].filter(Boolean).join(" ")}
                                disabled={action.disabled}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (action.disabled) return;
                                    action.onClick();
                                    closeMenu();
                                }}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        ) : null;

    return (
        <>
            <div ref={rootRef} className="zahl-row-actions-menu">
                <button
                    ref={triggerRef}
                    type="button"
                    className="icon-btn zahl-row-actions-menu__trigger"
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label={ariaLabel}
                    onClick={onTriggerClick}
                >
                    <MoreIcon size={16} />
                </button>
            </div>
            {menuNode && typeof document !== "undefined" ? createPortal(menuNode, document.body) : null}
        </>
    );
}
