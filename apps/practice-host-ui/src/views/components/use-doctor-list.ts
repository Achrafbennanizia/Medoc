/**
 * Cabinet+ doctor list for per-doctor filters and columns (tasks, orders; T5.4). Empty and
 * `show: false` in Essentiel and Cabinet (one dentist; doctor-context.ts).
 */
import { useEffect, useState } from "react";
import { DOCTOR_CONTEXT } from "@/lib/doctor-context";
import { listPhysicians, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";

export function useDoctorList() {
    const [doctors, setDoctors] = useState<PhysicianSummary[]>([]);
    useEffect(() => {
        if (!DOCTOR_CONTEXT.showDoctorUi) return;
        let alive = true;
        void listPhysicians()
            .catch(() => [])
            .then((docs) => {
                if (alive) setDoctors(docs);
            });
        return () => {
            alive = false;
        };
    }, []);
    const show = DOCTOR_CONTEXT.showDoctorUi && doctors.length > 1;
    const nameOf = (id?: string | null) => (id ? doctors.find((d) => d.id === id)?.name : undefined);
    return { show, doctors, nameOf };
}

export type DoctorList = ReturnType<typeof useDoctorList>;
