/**
 * Member devices: cluster reset is applied in Rust (`member_cluster_watch`) which
 * schedules a full app restart. This component is kept as a mount point for future
 * UI (e.g. countdown banner) and browser-build no-op.
 */
export function ClusterResetListener() {
    return null;
}
