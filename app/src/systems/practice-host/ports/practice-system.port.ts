/**
 * Practice Host system port (Interface Segregation / Dependency Inversion).
 * Desktop: Tauri IPC. Future LAN client: HTTP adapter implementing the same commands.
 */
export interface PracticeSystemPort {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}
