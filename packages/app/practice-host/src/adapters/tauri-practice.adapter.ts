import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";
import type { PracticeSystemPort } from "../ports/practice-system.port";

/** Adapter — Practice Host via Tauri IPC (current production path). */
export class TauriPracticeAdapter implements PracticeSystemPort {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        return tauriInvoke<T>(command, args);
    }
}

export { practiceSystem, createPracticeSystem, resetPracticeTransportCache } from "./practice-transport";
