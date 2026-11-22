/**
 * DEV-only capture bridge entry points. The loop and commands live in ./dev-capture/; this file keeps the
 * two imports used by main.tsx and App.tsx stable.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// eslint-disable-next-line react-refresh/only-export-components
export { startDevCaptureLoop } from "./dev-capture/loop";

/** Lets bridge commands navigate with the app's router instead of a full page change. */
export function DevCaptureNavBinder() {
    const navigate = useNavigate();
    useEffect(() => {
        window.__medocCaptureNavigate = (href, opts) => navigate(href, { replace: opts?.replace });
        return () => {
            delete window.__medocCaptureNavigate;
        };
    }, [navigate]);
    return null;
}
