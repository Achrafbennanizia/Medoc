/**
 * Replica post-login gate: paired when the master issued an activation token,
 * or when cluster SAS already marked this device as a provisioned member.
 */
export function replicaIsActivated(input: {
    mode: string;
    role: string;
    activationToken?: string | null;
    clusterProvisioned?: boolean | null;
    clusterIsOwner?: boolean | null;
    masterBaseUrl?: string | null;
}): boolean {
    const isReplica = input.mode === "serverless_peer" && input.role === "REPLICA";
    if (!isReplica) {
        return false;
    }
    if (Boolean(input.activationToken?.trim())) {
        return true;
    }
    if (Boolean(input.masterBaseUrl?.trim())) {
        return true;
    }
    return Boolean(input.clusterProvisioned);
}
