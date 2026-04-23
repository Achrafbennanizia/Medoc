import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

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
            <div className="space-y-1">
                {label && (
                    <label htmlFor={inputId} className="block text-label text-on-surface-variant">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className={cn(
                        "w-full h-9 px-3 rounded-lg bg-surface-bright border text-body text-on-surface placeholder:text-on-surface-variant/50 transition-colors duration-150 focus-ring",
                        error ? "border-error" : "border-surface-container hover:border-surface-overlay",
                        className,
                    )}
                    {...props}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy || undefined}
                />
                {error && (
                    <p id={errorId} className="text-caption text-error">
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

        return (
            <div className="space-y-1">
                {label && (
                    <label htmlFor={selectId} className="block text-label text-on-surface-variant">
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    id={selectId}
                    className={cn(
                        "w-full h-9 px-3 rounded-lg bg-surface-bright border text-body text-on-surface transition-colors duration-150 focus-ring appearance-none",
                        error ? "border-error" : "border-surface-container hover:border-surface-overlay",
                        className,
                    )}
                    {...props}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy || undefined}
                >
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p id={errorId} className="text-caption text-error">
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
            <div className="space-y-1">
                {label && (
                    <label htmlFor={taId} className="block text-label text-on-surface-variant">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={taId}
                    className={cn(
                        "w-full px-3 py-2 rounded-lg bg-surface-bright border text-body text-on-surface placeholder:text-on-surface-variant/50 transition-colors duration-150 focus-ring resize-y min-h-[80px]",
                        error ? "border-error" : "border-surface-container hover:border-surface-overlay",
                        className,
                    )}
                    {...props}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy || undefined}
                />
                {error && (
                    <p id={errorId} className="text-caption text-error">
                        {error}
                    </p>
                )}
            </div>
        );
    },
);
Textarea.displayName = "Textarea";
