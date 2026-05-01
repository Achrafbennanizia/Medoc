import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./views/components/error-boundary";
import { hydrateAppearanceFromStorage } from "./lib/client-settings";
import "./index.css";

hydrateAppearanceFromStorage();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
);
