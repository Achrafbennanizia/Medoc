import { describe, expect, it } from "vitest";

import { replicaIsActivated } from "./replica-activation-gate";

describe("replicaIsActivated", () => {
    it("requires activation token or cluster member provision", () => {
        expect(
            replicaIsActivated({
                mode: "serverless_peer",
                role: "REPLICA",
                activationToken: "",
                clusterProvisioned: false,
                clusterIsOwner: false,
            }),
        ).toBe(false);
        expect(
            replicaIsActivated({
                mode: "serverless_peer",
                role: "REPLICA",
                activationToken: "mt2.token",
            }),
        ).toBe(true);
        expect(
            replicaIsActivated({
                mode: "serverless_peer",
                role: "REPLICA",
                activationToken: "",
                clusterProvisioned: true,
                clusterIsOwner: false,
            }),
        ).toBe(true);
        expect(
            replicaIsActivated({
                mode: "serverless_peer",
                role: "REPLICA",
                clusterProvisioned: true,
                clusterIsOwner: true,
            }),
        ).toBe(true);
        expect(
            replicaIsActivated({
                mode: "serverless_peer",
                role: "REPLICA",
                clusterProvisioned: false,
                masterBaseUrl: "https://192.168.1.10:8787",
            }),
        ).toBe(true);
        expect(
            replicaIsActivated({
                mode: "serverless_peer",
                role: "MASTER",
                activationToken: "mt2.token",
            }),
        ).toBe(false);
    });
});
