type TimeSlotPickerProps = {
    value: string;
    onChange: (hhmm: string) => void;
    /** ISO dates (yyyy-MM-dd) where a slot is already taken — dims button. */
    busyKeys?: Set<string>;
    selectedDate: string;
    startHour?: number;
    endHour?: number;
    stepMinutes?: number;
};

function slots(startHour: number, endHour: number, step: number): string[] {
    const out: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
        for (let m = 0; m < 60; m += step) {
            if (h === endHour && m > 0) break;
            out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
    }
    return out;
}

/** Grid of selectable times (wireframe „Zeit“-Raster). */
export function TimeSlotPicker({
    value,
    onChange,
    busyKeys,
    selectedDate,
    startHour = 8,
    endHour = 18,
    stepMinutes = 30,
}: TimeSlotPickerProps) {
    const list = slots(startHour, endHour, stepMinutes);
    return (
        <div role="group" aria-label="Uhrzeit wählen" className="time-slot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
            {list.map((t) => {
                const busy = busyKeys?.has(`${selectedDate}|${t}`) ?? false;
                const active = value === t;
                return (
                    <button
                        key={t}
                        type="button"
                        className={`time-slot-btn ${active ? "active" : ""} ${busy ? "busy" : ""}`}
                        disabled={busy}
                        aria-pressed={active}
                        onClick={() => onChange(t)}
                        style={{
                            padding: "10px 6px",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 600,
                            border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
                            background: active ? "var(--accent-soft)" : busy ? "rgba(0,0,0,0.04)" : "#fff",
                            color: busy ? "var(--fg-4)" : "var(--fg)",
                            cursor: busy ? "not-allowed" : "pointer",
                        }}
                    >
                        {t.slice(0, 5)}
                    </button>
                );
            })}
        </div>
    );
}
