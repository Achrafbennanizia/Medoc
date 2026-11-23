import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDismissibleLayer } from "./ui/use-dismissible-layer";
import { useT, useTParams } from "@/lib/i18n";
import type { Patient } from "@/models/types";

import { filterPatients } from "@/lib/patient-search";
import { useClientSettings } from "@/lib/use-client-settings";
import { getPatient, listPatientsPaged } from "@/systems/practice-host/controllers/patient.controller";
const MAX_SHOWN_WHEN_NO_QUERY = 200;
/** Server search: matches per request, and the wait after the last keystroke. */
const REMOTE_PAGE = 20;
const REMOTE_DEBOUNCE_MS = 200;

type PatientComboFieldProps = {
    id: string;
    label: string;
    /** Patients to choose from. Omit to search on the server as you type (no full list in memory). */
    patients?: readonly Patient[];
    patientId: string;
    onPatientIdChange: (id: string) => void;
    /** The chosen patient record (or null when cleared), for callers that print or export it. */
    onPatientChange?: (patient: Patient | null) => void;
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
    patients: givenPatients,
    patientId,
    onPatientIdChange,
    onPatientChange,
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
    const remote = givenPatients === undefined;
    const [remoteRows, setRemoteRows] = useState<Patient[]>([]);
    const [remoteTotal, setRemoteTotal] = useState(0);
    const [selected, setSelected] = useState<Patient | null>(null);
    const patients: readonly Patient[] = remote ? remoteRows : givenPatients;

    // Server mode: one small page per (debounced) query instead of every patient.
    useEffect(() => {
        if (!remote || !open) return;
        let live = true;
        const q = query.trim();
        const timer = window.setTimeout(() => {
            listPatientsPaged({ page: 1, pageSize: REMOTE_PAGE, search: q || undefined })
                .then((r) => {
                    if (!live) return;
                    setRemoteRows(r.items);
                    setRemoteTotal(r.total);
                })
                .catch(() => live && setRemoteRows([]));
        }, q ? REMOTE_DEBOUNCE_MS : 0);
        return () => {
            live = false;
            window.clearTimeout(timer);
        };
    }, [remote, open, query]);

    // Server mode: a preselected id (e.g. from a link) is fetched alone for its name.
    useEffect(() => {
        if (!remote || !patientId || selected?.id === patientId) return;
        let live = true;
        getPatient(patientId)
            .then((p) => {
                if (!live) return;
                setSelected(p);
                setQuery(p.name);
                onPatientChange?.(p);
            })
            .catch(() => {
                if (!live) return;
                onPatientIdChange("");
                onPatientChange?.(null);
            });
        return () => {
            live = false;
        };
    }, [remote, patientId, selected?.id, onPatientChange, onPatientIdChange]);

    useEffect(() => {
        if (patientId) {
            const p = patients.find((x) => x.id === patientId);
            if (p) setQuery(p.name);
        }
    }, [patientId, patients]);

    useDismissibleLayer({ open, rootRef, onDismiss: () => setOpen(false) });

    const uniquePatients = useMemo(() => {
        const seen = new Set<string>();
        const out: Patient[] = [];
        for (const p of patients) {
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            out.push(p);
        }
        return out;
    }, [patients]);

    const nameCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of uniquePatients) {
            const key = p.name.trim().toLowerCase();
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
    }, [uniquePatients]);

    const includeInsuranceNumber = useClientSettings((c) => c.search?.patientIncludeInsuranceNumber !== false);
    const filtered = useMemo(() => {
        // The server already matched the query (name, insurance number, phone, email).
        if (remote) return [...uniquePatients];
        if (!query.trim()) {
            return uniquePatients.length > MAX_SHOWN_WHEN_NO_QUERY
                ? uniquePatients.slice(0, MAX_SHOWN_WHEN_NO_QUERY)
                : [...uniquePatients];
        }
        return filterPatients(uniquePatients, query, { includeInsuranceNumber });
    }, [uniquePatients, query, includeInsuranceNumber, remote]);

    function optionLabel(p: Patient): string {
        const shared = (nameCounts.get(p.name.trim().toLowerCase()) ?? 0) > 1;
        const dob = (p.date_of_birth ?? "").slice(0, 10);
        return shared && dob ? `${p.name} · ${dob}` : p.name;
    }

    function handleInputChange(version: string) {
        if (disabled) return;
        setQuery(version);
        onQueryChange?.(version);
        if (patientId) {
            const p = selected?.id === patientId ? selected : patients.find((x) => x.id === patientId);
            if (p && version !== p.name) {
                onPatientIdChange("");
                setSelected(null);
                onPatientChange?.(null);
            }
        }
        setOpen(true);
    }

    function pick(p: Patient) {
        setSelected(p);
        onPatientChange?.(p);
        onPatientIdChange(p.id);
        setQuery(p.name);
        onQueryChange?.(p.name);
        setOpen(false);
    }

    const noMatch = query.trim().length > 0 && filtered.length === 0;
    const manyTotal = remote
        ? !query.trim() && remoteTotal > REMOTE_PAGE
        : !query.trim() && patients.length > MAX_SHOWN_WHEN_NO_QUERY;

    return (
        <div ref={rootRef} className="patient-combo-field" style={{ marginBottom: "var(--space-2)" }}>
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
                                        {optionLabel(p)}
                                    </button>
                                );
                            })
                        )}
                    </div>
                ) : null}
            </div>
            {manyTotal ? (
                <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "6px 0 0" }}>
                    {tp("patient.combo.truncated", {
                        max: remote ? REMOTE_PAGE : MAX_SHOWN_WHEN_NO_QUERY,
                        total: remote ? remoteTotal : patients.length,
                    })}
                </p>
            ) : null}
        </div>
    );
}
