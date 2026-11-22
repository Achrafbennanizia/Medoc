/**
 * Build flavor of this app: the main app (hosts the practice) or the replica app (joins one).
 * Set at build time (`npm run build:replica` / `tauri:build:replica`) and matching the Rust feature
 * `replica`. See docs/architecture/device-flavors-and-access.md.
 */
export type DeviceFlavor = "main" | "replica";

export const DEVICE_FLAVOR: DeviceFlavor = import.meta.env.VITE_MEDOC_FLAVOR === "replica" ? "replica" : "main";

export const isReplicaApp = (): boolean => DEVICE_FLAVOR === "replica";

/** Operations only the main device performs (Rust `domain::device::MainOnly`). */
export type MainOnlyOperation = "manage_access" | "activate_license" | "manage_devices";

/** Where an operation runs on this device. */
export type Placement = "local" | "main_device" | "unavailable";
