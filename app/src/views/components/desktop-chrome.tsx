/* eslint-disable react-refresh/only-export-components -- context + hook exported together */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DesktopChromeMode } from "./resolve-desktop-chrome-mode";

const DesktopChromeContext = createContext<DesktopChromeMode>("browser");

export function DesktopChromeProvider({ mode, children }: { mode: DesktopChromeMode; children: ReactNode }) {
    const value = useMemo(() => mode, [mode]);
    return <DesktopChromeContext.Provider value={value}>{children}</DesktopChromeContext.Provider>;
}

export function useDesktopChromeMode(): DesktopChromeMode {
    return useContext(DesktopChromeContext);
}
