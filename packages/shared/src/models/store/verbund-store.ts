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
    loadError: string | null;
    setStatus: (status: VerbundStatusSnapshot | null) => void;
    setLoadError: (error: string | null) => void;
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
    loadError: null,
    setStatus: (status) => set({ status }),
    setLoadError: (loadError) => set({ loadError }),
    needsOnboarding: () => {
        const s = get().status;
        if (!s) return true;
        if (s.licensed) return false;
        if (s.provisioned && !s.isOwner) return false;
        return true;
    },
}));
