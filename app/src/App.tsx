import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./models/store/auth-store";
import { RoleRoute } from "./views/components/role-route";
import { SessionGate } from "./views/components/session-gate";
import { AppLayout } from "./views/layouts/app-layout";
import { LoginPage } from "./views/pages/login";
import { DashboardPage } from "./views/pages/dashboard";
import { TerminePage } from "./views/pages/termine";
import { PatientenPage } from "./views/pages/patienten";
import { PatientDetailPage } from "./views/pages/patient-detail";
import { FinanzenPage } from "./views/pages/finanzen";
import { LeistungenPage } from "./views/pages/leistungen";
import { ProduktePage } from "./views/pages/produkte";
import { PersonalPage } from "./views/pages/personal";
import { StatistikPage } from "./views/pages/statistik";
import { AuditPage } from "./views/pages/audit";
import { LoggingPage } from "./views/pages/logging";
import { OpsPage } from "./views/pages/ops";
import { CompliancePage } from "./views/pages/compliance";
import { RezeptePage } from "./views/pages/rezepte";
import { AttestePage } from "./views/pages/atteste";
import { EinstellungenPage } from "./views/pages/einstellungen";
import { DatenschutzPage } from "./views/pages/datenschutz";
import { BilanzPage } from "./views/pages/bilanz";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const session = useAuthStore((s) => s.session);
    if (!session) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export default function App() {
    return (
        <SessionGate>
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <AppLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<RoleRoute routePath=""><DashboardPage /></RoleRoute>} />
                    <Route path="termine" element={<RoleRoute routePath="termine"><TerminePage /></RoleRoute>} />
                    <Route path="patienten" element={<RoleRoute routePath="patienten"><PatientenPage /></RoleRoute>} />
                    <Route path="patienten/:id" element={<RoleRoute routePath="patienten/:id"><PatientDetailPage /></RoleRoute>} />
                    <Route path="finanzen" element={<RoleRoute routePath="finanzen"><FinanzenPage /></RoleRoute>} />
                    <Route path="bilanz" element={<RoleRoute routePath="bilanz"><BilanzPage /></RoleRoute>} />
                    <Route path="rezepte" element={<RoleRoute routePath="rezepte"><RezeptePage /></RoleRoute>} />
                    <Route path="atteste" element={<RoleRoute routePath="atteste"><AttestePage /></RoleRoute>} />
                    <Route path="leistungen" element={<RoleRoute routePath="leistungen"><LeistungenPage /></RoleRoute>} />
                    <Route path="produkte" element={<RoleRoute routePath="produkte"><ProduktePage /></RoleRoute>} />
                    <Route path="personal" element={<RoleRoute routePath="personal"><PersonalPage /></RoleRoute>} />
                    <Route path="statistik" element={<RoleRoute routePath="statistik"><StatistikPage /></RoleRoute>} />
                    <Route path="audit" element={<RoleRoute routePath="audit"><AuditPage /></RoleRoute>} />
                    <Route path="datenschutz" element={<RoleRoute routePath="datenschutz"><DatenschutzPage /></RoleRoute>} />
                    <Route path="einstellungen" element={<RoleRoute routePath="einstellungen"><EinstellungenPage /></RoleRoute>} />
                    <Route path="logs" element={<RoleRoute routePath="logs"><LoggingPage /></RoleRoute>} />
                    <Route path="ops" element={<RoleRoute routePath="ops"><OpsPage /></RoleRoute>} />
                    <Route path="compliance" element={<RoleRoute routePath="compliance"><CompliancePage /></RoleRoute>} />
                </Route>
            </Routes>
        </BrowserRouter>
        </SessionGate>
    );
}
