import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./views/components/error-boundary";
import { hydrateAppearanceFromStorage, initAppearanceMediaListener } from "./lib/client-settings";
import { bootstrapDocumentLocale } from "@/lib/i18n";
import "./index.css";

hydrateAppearanceFromStorage();
initAppearanceMediaListener();
bootstrapDocumentLocale();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
);
