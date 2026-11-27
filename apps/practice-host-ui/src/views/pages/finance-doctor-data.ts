/** Doctor and staff names for the finance list (T5.4); empty outside Cabinet+. */
import { useEffect, useState } from "react";
import { DOCTOR_CONTEXT } from "@/lib/doctor-context";
import { listPhysicians, listTaskTeamDirectory, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";

export function useFinanceDoctors() {
    const [doctors, setDoctors] = useState<PhysicianSummary[]>([]);
    const [names, setNames] = useState<Map<string, string>>(new Map());
    useEffect(() => {
        if (!DOCTOR_CONTEXT.showDoctorUi) return;
        let alive = true;
        void Promise.all([
            listPhysicians().catch(() => []),
            __CAP_TASKS__ ? listTaskTeamDirectory().catch(() => []) : Promise.resolve([]),
        ]).then(([docs, team]) => {
            if (!alive) return;
            setDoctors(docs);
            setNames(new Map([...team, ...docs].map((p) => [p.id, p.name])));
        });
        return () => {
            alive = false;
        };
    }, []);
    return { show: DOCTOR_CONTEXT.showDoctorUi && doctors.length > 1, doctors, nameOf: (id?: string | null) => (id ? names.get(id) : undefined) };
}

export type FinanceDoctors = ReturnType<typeof useFinanceDoctors>;
