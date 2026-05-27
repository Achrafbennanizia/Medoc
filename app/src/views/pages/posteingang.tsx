/**
 * Posteingang — DEAKTIVIERT
 *
 * Route, Navigation und IPC-Polling sind ausgeschaltet.
 * Aufgaben-Verwaltung: /verwaltung/aufgaben
 *
 * Die frühere Implementierung bleibt in der Git-Historie.
 */

import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "../components/ui/empty-state";

export function PosteingangPage() {
    const navigate = useNavigate();
    return (
        <div className="page">
            <EmptyState
                icon="📭"
                title="Posteingang deaktiviert"
                description="Der Posteingang ist vorübergehend abgeschaltet. Offene Aufgaben verwalten Sie unter Verwaltung → Praxis-Aufgaben."
                action={{ label: "Zu Praxis-Aufgaben", onClick: () => navigate("/verwaltung/aufgaben") }}
            />
            <p style={{ textAlign: "center", marginTop: 16 }}>
                <Link to="/verwaltung/aufgaben">Praxis-Aufgaben öffnen</Link>
            </p>
        </div>
    );
}

/* --- Original PosteingangPage (deaktiviert) ---
import { useCallback, useEffect, useState } from "react";
... entire previous implementation ...
*/
