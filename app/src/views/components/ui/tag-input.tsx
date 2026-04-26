import { useId, useMemo, useState } from "react";
import { XIcon } from "@/lib/icons";

const TAG_COLORS = ["#30D158", "#FF453A", "#0A84FF", "#AF52DE", "#FF9F0A"] as const;

type TagInputProps = {
    label: string;
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    suggestions?: string[];
    error?: string;
};

/** Multi-value chips + optional suggestions (wireframe „Beschwerden“). */
export function TagInput({ label, value, onChange, placeholder = "Eingabe und Enter", suggestions = [], error }: TagInputProps) {
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
            <label htmlFor={inputId} style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
                {label}
            </label>
            <div
                className="tag-input-shell"
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    minHeight: 44,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: error ? "1px solid var(--red)" : "1px solid var(--line-strong)",
                    background: "#fff",
                }}
            >
                {value.map((tag, i) => (
                    <span
                        key={tag}
                        className="tag-chip"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "#111",
                            background: `${TAG_COLORS[i % TAG_COLORS.length]}26`,
                            border: `1px solid ${TAG_COLORS[i % TAG_COLORS.length]}55`,
                        }}
                    >
                        {tag}
                        <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 20, height: 20, color: "var(--fg-2)" }}
                            aria-label={`${tag} entfernen`}
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
                    placeholder={value.length === 0 ? placeholder : ""}
                    style={{ flex: "1 1 120px", minWidth: 100, border: "none", outline: "none", fontSize: 14, background: "transparent" }}
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
