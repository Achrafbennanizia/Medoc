import { create } from "zustand";

export type SeatUsage = {
    adminUsed: number;
    memberUsed: number;
    totalUsed: number;
    maxAdmin: number;
    maxMember: number;
    maxTotal: number;
};

export type VerbundStatusSnapshot = {
    licensed: boolean;
    provisioned: boolean;
    isOwner: boolean;
    clusterId: string | null;
    seatUsage: SeatUsage | null;
    localFingerprint: string | null;
    licenseValid: boolean;
    licenseFormat: string | null;
    needsReprovision?: boolean;
};

type VerbundStore = {
    status: VerbundStatusSnapshot | null;
    setStatus: (status: VerbundStatusSnapshot | null) => void;
    needsOnboarding: () => boolean;
};

export const VERBUND_STATUS_READY: VerbundStatusSnapshot = {
    licensed: true,
    provisioned: true,
    isOwner: true,
    clusterId: "test-cluster",
    seatUsage: {
        adminUsed: 1,
        memberUsed: 0,
        totalUsed: 1,
        maxAdmin: 3,
        maxMember: 7,
        maxTotal: 10,
    },
    localFingerprint: "TESTFINGERPRINT",
    licenseValid: true,
    licenseFormat: "v2",
};

export const useVerbundStore = create<VerbundStore>((set, get) => ({
    status: null,
    setStatus: (status) => set({ status }),
    needsOnboarding: () => {
        const s = get().status;
        if (!s) return true;
        return !s.licensed && !s.provisioned;
    },
}));
