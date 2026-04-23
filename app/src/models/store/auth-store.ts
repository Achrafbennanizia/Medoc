import { create } from "zustand";
import type { Session } from "../types";

interface AuthState {
    session: Session | null;
    /** True after the first `get_session` completes (survives refresh for session restore). */
    sessionChecked: boolean;
    setSession: (session: Session | null) => void;
    clear: () => void;
    markSessionChecked: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    sessionChecked: false,
    setSession: (session) => set({ session }),
    clear: () => set({ session: null }),
    markSessionChecked: () => set({ sessionChecked: true }),
}));
