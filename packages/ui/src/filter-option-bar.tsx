export type FilterOption<T extends string = string> = {
    value: T;
    label: string;
};

type Props<T extends string> = {
    ariaLabel: string;
    value: T;
    options: readonly FilterOption<T>[];
    onChange: (value: T) => void;
    wrap?: boolean;
    /** Stretch bar and distribute options across full width. */
    fill?: boolean;
    className?: string;
};

/** Inline segment control — always visible, no dropdown (`.seg` / option bar). */
export function FilterOptionBar<T extends string>({
    ariaLabel,
    value,
    options,
    onChange,
    wrap = false,
    fill = false,
    className,
}: Props<T>) {
    return (
        <div
            className={[
                "option-bar seg",
                wrap ? "seg--wrap" : "",
                fill ? "option-bar--fill" : "",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            role="group"
            aria-label={ariaLabel}
        >
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    aria-pressed={value === opt.value}
                    onClick={() => {
                        if (value !== opt.value) onChange(opt.value);
                    }}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
