import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LanClientApp } from "./lan-client-app";
import "../../practice-host-ui/src/index.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <LanClientApp />
    </StrictMode>,
);
