import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDismissibleLayer } from "./ui/use-dismissible-layer";
import { useT, useTParams } from "@/lib/i18n";
import type { Patient } from "@/models/types";

const MAX_SHOWN_WHEN_NO_QUERY = 200;

type PatientComboFieldProps = {
    id: string;
    label: string;
    patients: readonly Patient[];
    patientId: string;
    onPatientIdChange: (id: string) => void;
    /** Optional: mirror typed query (e.g. privacy table filter). */
    onQueryChange?: (query: string) => void;
    disabled?: boolean;
    placeholder?: string;
};

/**
 * Single field: type to filter, list opens, click selects Patient (ID).
 */
export function PatientComboField({
    id,
    label,
    patients,
    patientId,
    onPatientIdChange,
    onQueryChange,
    disabled = false,
    placeholder,
}: PatientComboFieldProps) {
    const t = useT();
    const tp = useTParams();
    const resolvedPlaceholder = placeholder ?? t("patient.combo.placeholder");
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const listId = useId();

    useEffect(() => {
        if (patientId) {
            const p = patients.find((x) => x.id === patientId);
            if (p) setQuery(p.name);
        }
    }, [patientId, patients]);

    useDismissibleLayer({ open, rootRef, onDismiss: () => setOpen(false) });

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) {
            return patients.length > MAX_SHOWN_WHEN_NO_QUERY
                ? patients.slice(0, MAX_SHOWN_WHEN_NO_QUERY)
                : [...patients];
        }
        return patients.filter((p) => p.name.toLowerCase().includes(q));
    }, [patients, query]);

    function handleInputChange(version: string) {
        if (disabled) return;
        setQuery(version);
        onQueryChange?.(version);
        if (patientId) {
            const p = patients.find((x) => x.id === patientId);
            if (p && version !== p.name) {
                onPatientIdChange("");
            }
        }
        setOpen(true);
    }

    function pick(p: Patient) {
        onPatientIdChange(p.id);
        setQuery(p.name);
        onQueryChange?.(p.name);
        setOpen(false);
    }

    const noMatch = query.trim().length > 0 && filtered.length === 0;
    const manyTotal = !query.trim() && patients.length > MAX_SHOWN_WHEN_NO_QUERY;

    return (
        <div ref={rootRef} className="patient-combo-field" style={{ marginBottom: 8 }}>
            <label htmlFor={id} className="form-label">
                {label}
            </label>
            <div className="patient-combo-field__input-wrap" style={{ position: "relative" }}>
                <input
                    id={id}
                    type="text"
                    className="input-edit"
                    value={query}
                    placeholder={resolvedPlaceholder}
                    disabled={disabled}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => {
                        if (!disabled) setOpen(true);
                    }}
                />
                {open && !disabled && (filtered.length > 0 || noMatch) ? (
                    <div
                        id={listId}
                        className="select-menu patient-combo-field__list"
                        role="listbox"
                    >
                        {noMatch ? (
                            <div className="select-option" style={{ cursor: "default", opacity: 0.75 }}>
                                {t("patient.combo.no_match")}
                            </div>
                        ) : (
                            filtered.map((p) => {
                                const active = p.id === patientId;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        className={`select-option ${active ? "active" : ""}`}
                                        role="option"
                                        aria-selected={active}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => pick(p)}
                                    >
                                        {p.name}
                                    </button>
                                );
                            })
                        )}
                    </div>
                ) : null}
            </div>
            {manyTotal ? (
                <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "6px 0 0" }}>
                    {tp("patient.combo.truncated", { max: MAX_SHOWN_WHEN_NO_QUERY, total: patients.length })}
                </p>
            ) : null}
        </div>
    );
}
