import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "./ui/dialog";
import type { PaletteCommand } from "@/lib/command-palette-data";
import { SearchIcon } from "@/lib/icons";
import { suggestSimilarTitles } from "@/lib/string-suggest";
import { useT } from "@/lib/i18n";

type Props = {
    open: boolean;
    onClose: () => void;
    commands: PaletteCommand[];
    onNavigate: (href: string) => void;
};

export function CommandPalette({ open, onClose, commands, onNavigate }: Props) {
    const t = useT();
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter((c) => {
            const hay = `${c.titleDe} ${c.keywords.join(" ")}`.toLowerCase();
            return hay.includes(q);
        });
    }, [commands, query]);

    const fuzzyTitles = useMemo(() => commands.map((c) => c.titleDe), [commands]);
    const suggestions = useMemo(
        () => suggestSimilarTitles(query, fuzzyTitles, 2, 5),
        [query, fuzzyTitles],
    );

    useEffect(() => {
        if (!open) return;
        setQuery("");
        setSelected(0);
        queueMicrotask(() => inputRef.current?.focus());
    }, [open]);

    useEffect(() => {
        setSelected((s) => {
            if (filtered.length === 0) return 0;
            return Math.min(s, filtered.length - 1);
        });
    }, [filtered.length]);

    const activate = (href: string) => {
        onNavigate(href);
        onClose();
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelected((s) => Math.min(filtered.length - 1, s + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((s) => Math.max(0, s - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const item = filtered[selected];
            if (item) activate(item.href);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} title="Suche & Schnellzugriff" className="command-palette-dialog">
            <div className="command-palette-inner">
                <label className="sr-only" htmlFor="command-palette-q">
                    Seiten und Aktionen durchsuchen
                </label>
                <div
                    className="input"
                    style={{
                        marginBottom: 12,
                        borderRadius: "var(--radius-ctl)",
                    }}
                >
                    <SearchIcon size={14} aria-hidden />
                    <input
                        ref={inputRef}
                        id="command-palette-q"
                        type="search"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t("palette.placeholder")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onInputKeyDown}
                        aria-controls="command-palette-list"
                        aria-activedescendant={filtered[selected] ? `cmd-opt-${filtered[selected].id}` : undefined}
                    />
                </div>
                {filtered.length === 0 ? (
                    <div role="status">
                        <p style={{ color: "var(--fg-3)", fontSize: 13, margin: 0 }}>{t("palette.no_hits")}</p>
                        {suggestions.length > 0 ? (
                            <p style={{ color: "var(--fg-2)", fontSize: 13, margin: "10px 0 0" }}>
                                <span style={{ color: "var(--fg-3)" }}>{t("palette.suggest_prefix")}</span>{" "}
                                {suggestions.join(" · ")}
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <ul
                        id="command-palette-list"
                        role="listbox"
                        aria-label="Treffer"
                        style={{
                            listStyle: "none",
                            margin: 0,
                            padding: 0,
                            maxHeight: Math.min(360, filtered.length * 44),
                            overflowY: "auto",
                            borderRadius: 12,
                            border: "1px solid var(--line)",
                        }}
                    >
                        {filtered.map((c, i) => {
                            const isSel = i === selected;
                            return (
                                <li key={c.id} role="presentation">
                                    <button
                                        type="button"
                                        role="option"
                                        id={`cmd-opt-${c.id}`}
                                        aria-selected={isSel}
                                        className="command-palette-option"
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            padding: "10px 12px",
                                            fontSize: 13.5,
                                            fontWeight: 500,
                                            border: "none",
                                            borderBottom: "1px solid var(--line)",
                                            background: isSel ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "#fff",
                                            color: "var(--fg)",
                                            cursor: "pointer",
                                            transition: "background 80ms ease",
                                        }}
                                        onMouseEnter={() => setSelected(i)}
                                        onClick={() => activate(c.href)}
                                    >
                                        <span style={{ flex: 1 }}>{c.titleDe}</span>
                                        <kbd
                                            style={{
                                                fontSize: 10,
                                                padding: "2px 6px",
                                                borderRadius: 6,
                                                background: "rgba(0,0,0,0.05)",
                                                color: "var(--fg-4)",
                                            }}
                                        >
                                            ↵
                                        </kbd>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--fg-4)" }}>
                    <kbd style={{ padding: "1px 5px", borderRadius: 4, background: "rgba(0,0,0,0.06)" }}>↑</kbd>{" "}
                    <kbd style={{ padding: "1px 5px", borderRadius: 4, background: "rgba(0,0,0,0.06)" }}>↓</kbd>{" "}
                    Navigation ·{" "}
                    <kbd style={{ padding: "1px 5px", borderRadius: 4, background: "rgba(0,0,0,0.06)" }}>Enter</kbd>{" "}
                    öffnen · Esc schließen
                </p>
            </div>
        </Dialog>
    );
}
