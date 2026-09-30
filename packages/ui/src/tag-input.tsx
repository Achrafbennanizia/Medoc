import { useId, useMemo, useState, type CSSProperties } from "react";
import { XIcon } from "@/lib/icons";
import { useT, useTParams } from "@/lib/i18n";

const DAY_COLORS = ["#30D158", "#FF453A", "#0A84FF", "#AF52DE", "#FF9F0A"] as const;

type TagInputProps = {
    label: string;
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    suggestions?: string[];
    error?: string;
};

/** Multi-value chips + optional suggestions (wireframe „Beschwerden“). */
export function TagInput({ label, value, onChange, placeholder, suggestions = [], error }: TagInputProps) {
    const t = useT();
    const tParams = useTParams();
    const id = useId();
    const [draft, setDraft] = useState("");
    const inputId = `${id}-tag`;

    const add = (raw: string) => {
        const t = raw.trim();
        if (!t || value.includes(t)) return;
        onChange([...value, t]);
        setDraft("");
    };

    const sugFiltered = useMemo(() => {
        const d = draft.trim().toLowerCase();
        return suggestions.filter((s) => !value.includes(s) && (!d || s.toLowerCase().includes(d))).slice(0, 8);
    }, [draft, suggestions, value]);

    return (
        <div style={{ marginBottom: 8 }}>
            <label htmlFor={inputId} className="form-label">
                {label}
            </label>
            <div className={`tag-input-shell${error ? " tag-input-shell--error" : ""}`}>
                {value.map((tag, i) => (
                    <span
                        key={tag}
                        className="tag-chip"
                        style={{ "--tag-chip-accent": DAY_COLORS[i % DAY_COLORS.length] } as CSSProperties}
                    >
                        {tag}
                        <button
                            type="button"
                            className="icon-btn tag-chip-remove"
                            aria-label={tParams("a11y.remove_tag", { tag })}
                            onClick={() => onChange(value.filter((x) => x !== tag))}
                        >
                            <XIcon size={12} />
                        </button>
                    </span>
                ))}
                <input
                    id={inputId}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add(draft);
                        }
                    }}
                    placeholder={value.length === 0 ? (placeholder ?? t("common.tag_input_placeholder")) : ""}
                    className="tag-input-field"
                />
            </div>
            {sugFiltered.length > 0 ? (
                <div className="tag-suggestions" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {sugFiltered.map((s) => (
                        <button key={s} type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => add(s)}>
                            + {s}
                        </button>
                    ))}
                </div>
            ) : null}
            {error ? (
                <p role="alert" style={{ fontSize: 11.5, color: "var(--red)", marginTop: 6 }}>
                    {error}
                </p>
            ) : null}
        </div>
    );
}
