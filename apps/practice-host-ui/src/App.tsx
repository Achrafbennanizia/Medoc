import { lazy, Suspense, useEffect } from "react";
import { useT } from "@/lib/i18n";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./models/store/auth-store";
import { RoleRoute } from "./views/components/role-route";
import { DbSetupGate } from "./views/components/db-setup-gate";
import { LicenseAndPairingGate } from "./views/components/license-and-pairing-gate";
import { VerbundOnboardingGate } from "./views/components/verbund-onboarding-gate";
import { ClusterResetListener } from "./views/components/cluster-reset-listener";
import { ReplicaSyncBackground } from "./views/components/replica-sync-background";
import { PraxisArbeitszeitenBackground } from "./views/components/praxis-arbeitszeiten-background";
import { SessionGate } from "./views/components/session-gate";
import { DesktopWindowFrame } from "./views/components/desktop-window-frame";
import { AppLayout } from "./views/layouts/app-layout";
import { PageLoading } from "@/views/components/ui/page-status";
import { emitWorkflowEvent } from "./services/workflow-logging.service";

const LoginPage = lazy(async () => ({ default: (await import("./views/pages/login")).LoginPage }));
const DashboardPage = lazy(async () => ({ default: (await import("./views/pages/dashboard")).DashboardPage }));
const TerminePage = lazy(async () => ({ default: (await import("./views/pages/termine")).TerminePage }));
const TerminCreatePage = lazy(async () => ({ default: (await import("./views/pages/termin-create")).TerminCreatePage }));
const PatientenPage = lazy(async () => ({ default: (await import("./views/pages/patienten")).PatientenPage }));
const PatientDetailPage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/patient-detail/patient-detail")).PatientDetailPage }));
const AktenZuValidierenPage = lazy(async () => ({
    default: (await import("@/systems/practice-host/pages/akten-zu-validieren")).AktenZuValidierenPage,
}));
const PraxisTicketsPage = lazy(async () => ({
    default: (await import("./views/pages/praxis-tickets")).PraxisTicketsPage,
}));
const PraxisAufgabeCreatePage = lazy(async () => ({
    default: (await import("./views/pages/praxis-aufgabe-create")).PraxisAufgabeCreatePage,
}));
const PraxisAufgabeEditPage = lazy(async () => ({
    default: (await import("./views/pages/praxis-aufgabe-edit")).PraxisAufgabeEditPage,
}));
const FinanzenPage = lazy(async () => ({ default: (await import("./views/pages/finanzen")).FinanzenPage }));
const FinanzenKassePage = lazy(async () => ({ default: (await import("./views/pages/finanzen-kasse")).FinanzenKassePage }));
const ZahlungCreatePage = lazy(async () => ({ default: (await import("./views/pages/zahlung-create")).ZahlungCreatePage }));
const ZahlungKasseCreatePage = lazy(async () => ({
    default: (await import("./views/pages/zahlung-kasse-create")).ZahlungKasseCreatePage,
}));
const LeistungenPage = lazy(async () => ({ default: (await import("./views/pages/leistungen")).LeistungenPage }));
const ProduktePage = lazy(async () => ({ default: (await import("./views/pages/produkte")).ProduktePage }));
const PersonalPage = lazy(async () => ({ default: (await import("./views/pages/personal")).PersonalPage }));
const PersonalArbeitsplanPage = lazy(async () => ({
    default: (await import("./views/pages/personal-arbeitsplan")).PersonalArbeitsplanPage,
}));
const ArbeitszeitTrackingPage = lazy(async () => ({
    default: (await import("./views/pages/arbeitszeit-tracking")).ArbeitszeitTrackingPage,
}));
const ArbeitszeitTeamPage = lazy(async () => ({
    default: (await import("./views/pages/arbeitszeit-team")).ArbeitszeitTeamPage,
}));
const StatistikPage = lazy(async () => ({ default: (await import("./views/pages/statistik")).StatistikPage }));
const AuditPage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/audit")).AuditPage }));
const LoggingPage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/logging")).LoggingPage }));
const OpsPage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/ops")).OpsPage }));
const CompliancePage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/compliance")).CompliancePage }));
const RezeptePage = lazy(async () => ({ default: (await import("./views/pages/rezepte")).RezeptePage }));
const AttestePage = lazy(async () => ({ default: (await import("./views/pages/atteste")).AttestePage }));
const EinstellungenPage = lazy(async () => ({ default: (await import("./views/pages/einstellungen")).EinstellungenPage }));
const DatenschutzPage = lazy(async () => ({ default: (await import("./views/pages/datenschutz")).DatenschutzPage }));
const BilanzPage = lazy(async () => ({ default: (await import("./views/pages/bilanz")).BilanzPage }));
const BilanzNeuPage = lazy(async () => ({ default: (await import("./views/pages/bilanz-neu")).BilanzNeuPage }));
const VerwaltungPage = lazy(async () => ({ default: (await import("./views/pages/verwaltung")).VerwaltungPage }));
const VerwaltungFinanzWerkzeugePage = lazy(async () => ({
    default: (await import("./views/pages/verwaltung-finanz-werkzeuge")).VerwaltungFinanzWerkzeugePage,
}));
const VerwaltungFinanzenBerichtePage = lazy(async () => ({
    default: (await import("./views/pages/verwaltung-finanzen-berichte")).VerwaltungFinanzenBerichtePage,
}));
const VerwaltungTeamPage = lazy(async () => ({
    default: (await import("./views/pages/verwaltung-team")).VerwaltungTeamPage,
}));
const TagesabschlussPage = lazy(async () => ({
    default: (await import("./views/pages/tagesabschluss")).TagesabschlussPage,
}));
const VerwaltungLagerBestellwesenPage = lazy(async () => ({
    default: (await import("./views/pages/verwaltung-lager-bestellwesen")).VerwaltungLagerBestellwesenPage,
}));
const VerwaltungLeistungenKatalogeVorlagenPage = lazy(async () => ({
    default: (await import("./views/pages/verwaltung-leistungen-kataloge-vorlagen")).VerwaltungLeistungenKatalogeVorlagenPage,
}));
const VerwaltungVertraegePage = lazy(async () => ({
    default: (await import("./views/pages/verwaltung-vertraege")).VerwaltungVertraegePage,
}));
const BehandlungsKatalogPage = lazy(async () => ({ default: (await import("./views/pages/behandlungs-katalog")).BehandlungsKatalogPage }));
const KrankenbescheinigungFormPage = lazy(async () => ({
    default: (await import("./views/pages/krankenbescheinigung-verwaltung")).KrankenbescheinigungFormPage,
}));
const BestellstammVerwaltungPage = lazy(async () => ({ default: (await import("./views/pages/bestellstamm-verwaltung")).BestellstammVerwaltungPage }));
const ArbeitstagePage = lazy(async () => ({ default: (await import("./views/pages/arbeitstage")).ArbeitstagePage }));
const PraxisplanungPage = lazy(async () => ({ default: (await import("./views/pages/praxisplanung")).PraxisplanungPage }));
const ArbeitszeitenPage = lazy(async () => ({ default: (await import("./views/pages/arbeitszeiten")).ArbeitszeitenPage }));
const SonderSperrzeitenPage = lazy(async () => ({ default: (await import("./views/pages/sonder-sperrzeiten")).SonderSperrzeitenPage }));
const PraxisPraeferenzenPage = lazy(async () => ({ default: (await import("./views/pages/praxis-praeferenzen")).PraxisPraeferenzenPage }));
const VorlagenRezepteAttestePage = lazy(async () => ({ default: (await import("./views/pages/vorlagen-rezepte-atteste")).VorlagenRezepteAttestePage }));
const VorlageEditorPage = lazy(async () => ({ default: (await import("./views/pages/vorlage-editor")).VorlageEditorPage }));
const PatientCreatePage = lazy(async () => ({ default: (await import("./views/pages/patient-create")).PatientCreatePage }));
const RezeptCreatePage = lazy(async () => ({ default: (await import("./views/pages/rezept-create")).RezeptCreatePage }));
const RezeptEditPage = lazy(async () => ({ default: (await import("./views/pages/rezept-edit")).RezeptEditPage }));
const BestellungenPage = lazy(async () => ({ default: (await import("./views/pages/bestellungen")).BestellungenPage }));
const BestellungCreatePage = lazy(async () => ({ default: (await import("./views/pages/bestellung-create")).BestellungCreatePage }));
const BestellungDetailPage = lazy(async () => ({ default: (await import("./views/pages/bestellung-detail")).BestellungDetailPage }));
const FeedbackPage = lazy(async () => ({ default: (await import("./views/pages/feedback")).FeedbackPage }));
const MigrationWizardPage = lazy(async () => ({ default: (await import("./views/pages/migration-wizard")).MigrationWizardPage }));
const HilfePage = lazy(async () => ({ default: (await import("./views/pages/hilfe")).HilfePage }));
const LizenzAktivierenOnboardingPage = lazy(async () => ({
    default: (await import("@/systems/practice-host/pages/onboarding/lizenz-aktivieren")).LizenzAktivierenOnboardingPage,
}));
const KontoEinrichtenOnboardingPage = lazy(async () => ({
    default: (await import("@/systems/practice-host/pages/onboarding/konto-einrichten")).KontoEinrichtenOnboardingPage,
}));
const AbonnementRegistrierenOnboardingPage = lazy(async () => ({
    default: (await import("@/systems/practice-host/pages/onboarding/abonnement-registrieren"))
        .AbonnementRegistrierenOnboardingPage,
}));
const VerbundBeitretenPage = lazy(async () => ({
    default: (await import("@/systems/lan/pages/verbund-beitreten")).VerbundBeitretenPage,
}));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const session = useAuthStore((s) => s.session);
    if (!session) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function RouteFallback() {
    const t = useT();
    return (
        <div className="route-fallback">
            <PageLoading label={t("app.page_loading")} />
        </div>
    );
}

function WorkflowRouteLogger() {
    const location = useLocation();
    useEffect(() => {
        void emitWorkflowEvent({
            workflow: "ui-navigation",
            step: "route_enter",
            route: location.pathname,
        });
    }, [location.pathname]);
    return null;
}

export default function App() {
    return (
        <DbSetupGate>
        <SessionGate>
        <DesktopWindowFrame>
        <BrowserRouter>
        <WorkflowRouteLogger />
        <ClusterResetListener />
        <VerbundOnboardingGate>
            <Routes>
                <Route
                    path="/onboarding"
                    element={<Navigate to="/onboarding/lizenz" replace />}
                />
                <Route path="/onboarding/aktivierung" element={<Navigate to="/onboarding/lizenz" replace />} />
                <Route
                    path="/onboarding/abonnement"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <AbonnementRegistrierenOnboardingPage />
                        </Suspense>
                    )}
                />
                <Route
                    path="/onboarding/konto"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <KontoEinrichtenOnboardingPage />
                        </Suspense>
                    )}
                />
                <Route
                    path="/onboarding/lizenz"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <LizenzAktivierenOnboardingPage />
                        </Suspense>
                    )}
                />
                <Route
                    path="/onboarding/beitreten"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <VerbundBeitretenPage />
                        </Suspense>
                    )}
                />
                <Route
                    path="/login"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <LoginPage />
                        </Suspense>
                    )}
                />
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <LicenseAndPairingGate>
                                <ReplicaSyncBackground />
                                <PraxisArbeitszeitenBackground />
                                <AppLayout />
                            </LicenseAndPairingGate>
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<RoleRoute routePath=""><DashboardPage /></RoleRoute>} />
                    <Route path="termine" element={<RoleRoute routePath="termine"><TerminePage /></RoleRoute>} />
                    <Route path="termine/neu" element={<RoleRoute routePath="termine/neu"><TerminCreatePage /></RoleRoute>} />
                    <Route path="patienten" element={<RoleRoute routePath="patienten"><PatientenPage /></RoleRoute>} />
                    <Route path="patienten/neu" element={<RoleRoute routePath="patienten/neu"><PatientCreatePage /></RoleRoute>} />
                    <Route path="patienten/:id/rezept/neu" element={<RoleRoute routePath="patienten/:id/rezept/neu"><RezeptCreatePage /></RoleRoute>} />
                    <Route path="patienten/:id/rezept/:rezeptId" element={<RoleRoute routePath="patienten/:id/rezept/:rezeptId"><RezeptEditPage /></RoleRoute>} />
                    <Route path="patienten/:id" element={<RoleRoute routePath="patienten/:id"><PatientDetailPage /></RoleRoute>} />
                    <Route
                        path="akten/zu-validieren"
                        element={(
                            <RoleRoute routePath="akten/zu-validieren">
                                <AktenZuValidierenPage />
                            </RoleRoute>
                        )}
                    />
                    <Route path="tickets/neu" element={<RoleRoute routePath="tickets/neu"><PraxisAufgabeCreatePage /></RoleRoute>} />
                    <Route path="tickets/:id/bearbeiten" element={<RoleRoute routePath="tickets/:id/bearbeiten"><PraxisAufgabeEditPage /></RoleRoute>} />
                    <Route path="tickets" element={<RoleRoute routePath="tickets"><PraxisTicketsPage /></RoleRoute>} />
                    <Route path="posteingang" element={<Navigate to="/tickets" replace />} />
                    <Route path="finanzen" element={<RoleRoute routePath="finanzen"><FinanzenPage /></RoleRoute>} />
                    <Route path="finanzen/kasse/neu" element={<RoleRoute routePath="finanzen/kasse/neu"><ZahlungKasseCreatePage /></RoleRoute>} />
                    <Route path="finanzen/kasse" element={<RoleRoute routePath="finanzen/kasse"><FinanzenKassePage /></RoleRoute>} />
                    <Route path="finanzen/neu" element={<RoleRoute routePath="finanzen/neu"><ZahlungCreatePage /></RoleRoute>} />
                    <Route path="bestellungen" element={<RoleRoute routePath="bestellungen"><BestellungenPage /></RoleRoute>} />
                    <Route path="bestellungen/neu" element={<RoleRoute routePath="bestellungen/neu"><BestellungCreatePage /></RoleRoute>} />
                    <Route path="bestellungen/:id" element={<RoleRoute routePath="bestellungen/:id"><BestellungDetailPage /></RoleRoute>} />
                    <Route path="bilanz" element={<RoleRoute routePath="bilanz"><BilanzPage /></RoleRoute>} />
                    <Route path="bilanz/neu" element={<RoleRoute routePath="bilanz/neu"><BilanzNeuPage /></RoleRoute>} />
                    <Route path="verwaltung" element={<RoleRoute routePath="verwaltung"><VerwaltungPage /></RoleRoute>} />
                    <Route
                        path="verwaltung/team"
                        element={(
                            <RoleRoute routePath="verwaltung/team">
                                <VerwaltungTeamPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="verwaltung/team/arbeitszeit"
                        element={(
                            <RoleRoute routePath="verwaltung/team/arbeitszeit">
                                <ArbeitszeitTeamPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="verwaltung/aufgaben"
                        element={<Navigate to="/tickets?tab=verwalten" replace />}
                    />
                    <Route path="verwaltung/arbeitstage" element={<RoleRoute routePath="verwaltung/arbeitstage"><ArbeitstagePage /></RoleRoute>} />
                    <Route path="verwaltung/praxisplanung" element={<RoleRoute routePath="verwaltung/praxisplanung"><PraxisplanungPage /></RoleRoute>} />
                    <Route path="verwaltung/arbeitszeiten" element={<RoleRoute routePath="verwaltung/arbeitszeiten"><ArbeitszeitenPage /></RoleRoute>} />
                    <Route path="verwaltung/sonder-sperrzeiten" element={<RoleRoute routePath="verwaltung/sonder-sperrzeiten"><SonderSperrzeitenPage /></RoleRoute>} />
                    <Route path="verwaltung/praxis-praeferenzen" element={<RoleRoute routePath="verwaltung/praxis-praeferenzen"><PraxisPraeferenzenPage /></RoleRoute>} />
                    <Route path="verwaltung/vorlagen" element={<RoleRoute routePath="verwaltung/vorlagen"><VorlagenRezepteAttestePage /></RoleRoute>} />
                    <Route path="verwaltung/vorlagen/editor/:id" element={<RoleRoute routePath="verwaltung/vorlagen/editor"><VorlageEditorPage /></RoleRoute>} />
                    <Route path="verwaltung/vorlagen/editor" element={<RoleRoute routePath="verwaltung/vorlagen/editor"><VorlageEditorPage /></RoleRoute>} />
                    <Route path="verwaltung/behandlungs-katalog" element={<RoleRoute routePath="verwaltung/behandlungs-katalog"><BehandlungsKatalogPage /></RoleRoute>} />
                    <Route path="verwaltung/bestellstamm" element={<RoleRoute routePath="verwaltung/bestellstamm"><BestellstammVerwaltungPage /></RoleRoute>} />
                    <Route
                        path="verwaltung/finanzen-berichte"
                        element={(
                            <RoleRoute routePath="verwaltung/finanzen-berichte">
                                <VerwaltungFinanzenBerichtePage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="verwaltung/finanzen-berichte/tagesabschluss"
                        element={(
                            <RoleRoute routePath="verwaltung/finanzen-berichte/tagesabschluss">
                                <TagesabschlussPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="verwaltung/finanzen-berichte/rechnung"
                        element={(
                            <RoleRoute routePath="verwaltung/finanzen-berichte/rechnung">
                                <VerwaltungFinanzWerkzeugePage />
                            </RoleRoute>
                        )}
                    />
                    <Route path="verwaltung/tagesabschluss" element={<Navigate to="/verwaltung/finanzen-berichte/tagesabschluss" replace />} />
                    <Route path="verwaltung/finanzen-werkzeuge" element={<Navigate to="/verwaltung/finanzen-berichte/rechnung" replace />} />
                    <Route
                        path="verwaltung/lager-und-bestellwesen"
                        element={(
                            <RoleRoute routePath="verwaltung/lager-und-bestellwesen">
                                <VerwaltungLagerBestellwesenPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="verwaltung/vertraege"
                        element={(
                            <RoleRoute routePath="verwaltung/vertraege">
                                <VerwaltungVertraegePage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="verwaltung/leistungen-kataloge-vorlagen"
                        element={(
                            <RoleRoute routePath="verwaltung/leistungen-kataloge-vorlagen">
                                <VerwaltungLeistungenKatalogeVorlagenPage />
                            </RoleRoute>
                        )}
                    />
                    <Route path="rezepte" element={<RoleRoute routePath="rezepte"><RezeptePage /></RoleRoute>} />
                    <Route path="atteste" element={<RoleRoute routePath="atteste"><AttestePage /></RoleRoute>} />
                    <Route path="leistungen" element={<RoleRoute routePath="leistungen"><LeistungenPage /></RoleRoute>} />
                    <Route
                        path="leistungen/neu"
                        element={(
                            <RoleRoute routePath="leistungen/neu">
                                <Navigate to="/leistungen?neu=1" replace />
                            </RoleRoute>
                        )}
                    />
                    <Route path="produkte" element={<RoleRoute routePath="produkte"><ProduktePage /></RoleRoute>} />
                    <Route path="personal" element={<RoleRoute routePath="personal"><PersonalPage /></RoleRoute>} />
                    <Route
                        path="personal/arbeitsplan"
                        element={(
                            <RoleRoute routePath="personal/arbeitsplan">
                                <PersonalArbeitsplanPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="personal/arbeitszeit"
                        element={(
                            <RoleRoute routePath="personal/arbeitszeit">
                                <ArbeitszeitTrackingPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="verwaltung/krankenbescheinigung"
                        element={(
                            <RoleRoute routePath="verwaltung/krankenbescheinigung">
                                <KrankenbescheinigungFormPage />
                            </RoleRoute>
                        )}
                    />
                    <Route path="personal/neu" element={<RoleRoute routePath="personal/neu"><Navigate to="/personal?neu=1" replace /></RoleRoute>} />
                    <Route path="statistik" element={<RoleRoute routePath="statistik"><StatistikPage /></RoleRoute>} />
                    <Route path="audit" element={<RoleRoute routePath="audit"><AuditPage /></RoleRoute>} />
                    <Route path="datenschutz" element={<RoleRoute routePath="datenschutz"><DatenschutzPage /></RoleRoute>} />
                    <Route path="einstellungen" element={<RoleRoute routePath="einstellungen"><EinstellungenPage /></RoleRoute>} />
                    <Route path="logs" element={<RoleRoute routePath="logs"><LoggingPage /></RoleRoute>} />
                    <Route path="ops" element={<RoleRoute routePath="ops"><OpsPage /></RoleRoute>} />
                    <Route path="compliance" element={<RoleRoute routePath="compliance"><CompliancePage /></RoleRoute>} />
                    <Route path="hilfe" element={<RoleRoute routePath="hilfe"><Suspense fallback={<RouteFallback />}><HilfePage /></Suspense></RoleRoute>} />
                    <Route path="feedback" element={<RoleRoute routePath="feedback"><FeedbackPage /></RoleRoute>} />
                    <Route path="migration" element={<RoleRoute routePath="migration"><MigrationWizardPage /></RoleRoute>} />
                </Route>
            </Routes>
        </VerbundOnboardingGate>
        </BrowserRouter>
        </DesktopWindowFrame>
        </SessionGate>
        </DbSetupGate>
    );
}
