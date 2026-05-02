import { useCallback, useEffect, useState } from "react";
import {
    BREAK_GLASS_WINDOW_SECS,
    breakGlassActive,
    type BreakGlassEntry,
} from "@/controllers/break-glass.controller";
import { listPatienten } from "@/controllers/patient.controller";
import type { Patient } from "@/models/types";

function formatRemaining(totalSecs: number): string {
    const s = Math.max(0, Math.floor(totalSecs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * ISO 22600-style visibility: shows when break-glass is active for the signed-in user.
 */
export function BreakGlassBanner({ userId }: { userId: string | undefined }) {
    const [mine, setMine] = useState<BreakGlassEntry[]>([]);
    const [names, setNames] = useState<Map<string, string>>(new Map());

    const loadNames = useCallback(async (rows: BreakGlassEntry[]) => {
        const ids = [...new Set(rows.map((r) => r.patient_id).filter(Boolean) as string[])];
        if (ids.length === 0) {
            setNames(new Map());
            return;
        }
        try {
            const all: Patient[] = await listPatienten();
            const m = new Map<string, string>();
            for (const p of all) {
                if (ids.includes(p.id)) m.set(p.id, p.name);
            }
            setNames(m);
        } catch {
            setNames(new Map());
        }
    }, []);

    const poll = useCallback(async () => {
        if (!userId) {
            setMine([]);
            return;
        }
        try {
            const rows = await breakGlassActive();
            const filtered = rows.filter((r) => r.user_id === userId);
            setMine(filtered);
            await loadNames(filtered);
        } catch {
            setMine([]);
        }
    }, [userId, loadNames]);

    useEffect(() => {
        void poll();
    }, [poll]);

    useEffect(() => {
        const id = window.setInterval(() => {
            void poll();
        }, 30_000);
        const onRefresh = () => {
            void poll();
        };
        window.addEventListener("medoc-break-glass-refresh", onRefresh);
        return () => {
            window.clearInterval(id);
            window.removeEventListener("medoc-break-glass-refresh", onRefresh);
        };
    }, [poll]);

    if (!userId || mine.length === 0) return null;

    const remainSecs = Math.min(
        ...mine.map((e) => Math.max(0, BREAK_GLASS_WINDOW_SECS - Number(e.elapsed_secs ?? 0))),
    );
    const patientBits = mine.map((e) => {
        if (!e.patient_id) return "ohne konkreten Patientenbezug";
        return names.get(e.patient_id) ?? `Patient ${e.patient_id.slice(0, 8)}…`;
    });
    const patientLabel = [...new Set(patientBits)].join(", ");

    return (
        <div
            role="status"
            className="break-glass-banner"
            style={{
                flexShrink: 0,
                padding: "10px 16px",
                background: "color-mix(in oklab, var(--red) 12%, var(--bg-elev))",
                borderBottom: "1px solid color-mix(in oklab, var(--red) 35%, var(--line))",
                color: "var(--fg)",
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.35,
            }}
        >
            Notfallzugriff aktiv — {patientLabel} — verbleibend {formatRemaining(remainSecs)} (max.{" "}
            {Math.floor(BREAK_GLASS_WINDOW_SECS / 60)} Min. ab Aktivierung)
        </div>
    );
}
