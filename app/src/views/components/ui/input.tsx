import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId, useMemo, useRef, useState } from "react";
import { useDismissibleLayer } from "./use-dismissible-layer";

/* ── Text Input ── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
        const genId = useId();
        const inputId = id ?? genId;
        const errorId = `${inputId}-error`;
        const describedBy =
            error && ariaDescribedBy ? `${errorId} ${ariaDescribedBy}` : error ? errorId : ariaDescribedBy;

        return (
            <div style={{ marginBottom: 8 }} className={error ? "input-wrap--error" : undefined}>
                {label && (
                    <label htmlFor={inputId} style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={["input-edit", error ? "ui-field-error" : "", className].filter(Boolean).join(" ")}
                    {...props}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy || undefined}
                />
                {error && (
                    <p id={errorId} style={{ fontSize: 11.5, color: "var(--red)", marginTop: 4 }}>
                        {error}
                    </p>
                )}
            </div>
        );
    },
);
Input.displayName = "Input";

/* ── Select ── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, id, options, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
        const genId = useId();
        const selectId = id ?? genId;
        const errorId = `${selectId}-error`;
        const describedBy =
            error && ariaDescribedBy ? `${errorId} ${ariaDescribedBy}` : error ? errorId : ariaDescribedBy;

        const [open, setOpen] = useState(false);
        const rootRef = useRef<HTMLDivElement>(null);
        useDismissibleLayer({
            open,
            rootRef,
            onDismiss: () => setOpen(false),
        });

        const selectedValue = useMemo(() => {
            const current = props.value as string | undefined;
            if (current != null) return String(current);
            const fallback = props.defaultValue as string | undefined;
            if (fallback != null) return String(fallback);
            return options[0]?.value ?? "";
        }, [options, props.defaultValue, props.value]);

        const selectedLabel =
            options.find((o) => o.value === selectedValue)?.label ?? options[0]?.label ?? "";

        const chooseValue = (nextValue: string) => {
            if (props.disabled) return;
            props.onChange?.({
                target: { value: nextValue, name: props.name },
                currentTarget: { value: nextValue, name: props.name },
            } as unknown as Parameters<NonNullable<SelectProps["onChange"]>>[0]);
            setOpen(false);
        };

        return (
            <div style={{ marginBottom: 8 }} ref={rootRef} className={error ? "input-wrap--error" : undefined}>
                {label && (
                    <label htmlFor={selectId} style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
                        {label}
                    </label>
                )}
                <div className="select-wrap">
                    <button
                        id={selectId}
                        type="button"
                        className={["input-edit", "select-edit", "select-trigger", error ? "ui-field-error" : "", className].filter(Boolean).join(" ")}
                        onClick={() => setOpen((v) => !v)}
                        disabled={props.disabled}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy || undefined}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                    >
                        <span className="select-trigger-label">{selectedLabel}</span>
                    </button>
                    <select
                        ref={ref}
                        value={selectedValue}
                        onChange={() => { }}
                        name={props.name}
                        required={props.required}
                        tabIndex={-1}
                        aria-hidden
                        style={{ display: "none" }}
                    >
                        {options.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    {open && (
                        <div className="select-menu" role="listbox" aria-labelledby={selectId}>
                            {options.map((o) => {
                                const active = o.value === selectedValue;
                                return (
                                    <button
                                        key={o.value}
                                        type="button"
                                        className={`select-option ${active ? "active" : ""}`}
                                        role="option"
                                        aria-selected={active}
                                        onClick={() => chooseValue(o.value)}
                                    >
                                        {o.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                {error && (
                    <p id={errorId} style={{ fontSize: 11.5, color: "var(--red)", marginTop: 4 }}>
                        {error}
                    </p>
                )}
            </div>
        );
    },
);
Select.displayName = "Select";

/* ── Textarea ── */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, error, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
        const genId = useId();
        const taId = id ?? genId;
        const errorId = `${taId}-error`;
        const describedBy =
            error && ariaDescribedBy ? `${errorId} ${ariaDescribedBy}` : error ? errorId : ariaDescribedBy;

        return (
            <div style={{ marginBottom: 8 }} className={error ? "input-wrap--error" : undefined}>
                {label && (
                    <label htmlFor={taId} style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={taId}
                    className={["input-edit", error ? "ui-field-error" : "", className].filter(Boolean).join(" ")}
                    {...props}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy || undefined}
                />
                {error && (
                    <p id={errorId} style={{ fontSize: 11.5, color: "var(--red)", marginTop: 4 }}>
                        {error}
                    </p>
                )}
            </div>
        );
    },
);
Textarea.displayName = "Textarea";
