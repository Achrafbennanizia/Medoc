import { useEffect, useRef, useState } from "react";
import { ariaForLabel, pickLabel, type LabelKey } from "@/lib/abbreviations";

const CONTAINER_SHORT_PX = 200;

export type ResponsiveLabelProps = {
    labelKey: LabelKey;
    className?: string;
    as?: "span" | "label";
    htmlFor?: string;
};

/**
 * Picks full vs short label from {@link LABELS} using the **element** width (ResizeObserver),
 * not the viewport. Accessible name uses the curated `aria` string (full meaning).
 */
export function ResponsiveLabel({ labelKey, className, as = "span", htmlFor }: ResponsiveLabelProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const [short, setShort] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? CONTAINER_SHORT_PX;
            setShort(w < CONTAINER_SHORT_PX);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const text = pickLabel(labelKey, short ? "short" : "full");
    const aria = ariaForLabel(labelKey);

    if (as === "label") {
        return (
            <label className={className} htmlFor={htmlFor} aria-label={aria} title={aria}>
                <span ref={ref}>{text}</span>
            </label>
        );
    }

    return (
        <span ref={ref} className={className} aria-label={aria} title={aria}>
            {text}
        </span>
    );
}
