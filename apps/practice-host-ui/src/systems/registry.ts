/**
 * System registry (Facade) — three deployable backends.
 *
 * | Key | System | Transport today |
 * |-----|--------|-----------------|
 * | `practice` | Practice Host | Tauri IPC |
 * | `lan` | LAN server control | Tauri IPC |
 * | `company` | Vendor portal | Tauri IPC → HTTP |
 */
import { companySystem } from "./company-portal/adapters/tauri-company.adapter";
import { lanSystem } from "./lan/adapters/tauri-lan.adapter";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";

export const systems = {
    practice: practiceSystem,
    lan: lanSystem,
    company: companySystem,
} as const;

export type MedocSystemKey = keyof typeof systems;
