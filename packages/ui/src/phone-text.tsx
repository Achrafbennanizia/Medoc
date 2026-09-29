import type { HTMLAttributes, ReactNode } from "react";

type PhoneTextProps = {
    value?: string | null;
    empty?: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children">;

/** Keeps telephone numbers in stored Latin digits and LTR order (RTL UIs). */
export function PhoneText({ value, empty = "—", className, ...rest }: PhoneTextProps) {
    const v = (value ?? "").trim();
    if (!v) return <>{empty}</>;
    return (
        <span
            className={["phone-text", className].filter(Boolean).join(" ")}
            dir="ltr"
            data-arabic-numerals-skip
            {...rest}
        >
            {v}
        </span>
    );
}
