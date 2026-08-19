import { useT } from "@/lib/i18n";

type TimeSlotPickerProps = {
    value: string;
    onChange: (hhmm: string) => void;
    /** ISO dates (yyyy-MM-dd) where a slot is already taken — dims button. */
    busyKeys?: Set<string>;
    selectedDate: string;
    /** When set, renders exactly these times (from practice hours / availability). */
    slots?: string[];
    startHour?: number;
    endHour?: number;
    stepMinutes?: number;
    emptyLabel?: string;
};

function slotsFromRange(startHour: number, endHour: number, step: number): string[] {
    const out: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
        for (let m = 0; m < 60; m += step) {
            if (h === endHour && m > 0) break;
            out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
    }
    return out;
}

/** Grid of selectable times driven by practice hours and availability data. */
export function TimeSlotPicker({
    value,
    onChange,
    busyKeys,
    selectedDate,
    slots,
    startHour = 8,
    endHour = 18,
    stepMinutes = 30,
    emptyLabel,
}: TimeSlotPickerProps) {
    const t = useT();
    const list = slots ?? slotsFromRange(startHour, endHour, stepMinutes);
    if (list.length === 0) {
        return (
            <p className="time-slot-grid-empty" style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>
                {emptyLabel ?? t("appointment.create.time_no_slots")}
            </p>
        );
    }
    return (
        <div role="group" aria-label={t("a11y.pick_time")} className="time-slot-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8 }}>
            {list.map((slot) => {
                const busy = busyKeys?.has(`${selectedDate}|${slot}`) ?? false;
                const active = value === slot;
                return (
                    <button
                        key={slot}
                        type="button"
                        className={`time-slot-btn ${active ? "active" : ""} ${busy ? "busy" : ""}`}
                        disabled={busy}
                        aria-pressed={active}
                        onClick={() => onChange(slot)}
                        style={{
                            padding: "10px 6px",
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 600,
                            border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
                            background: active ? "var(--accent-soft)" : busy ? "rgba(0,0,0,0.04)" : "var(--bg-elev)",
                            color: busy ? "var(--fg-4)" : "var(--fg)",
                            cursor: busy ? "not-allowed" : "pointer",
                        }}
                    >
                        {slot.slice(0, 5)}
                    </button>
                );
            })}
        </div>
    );
}
