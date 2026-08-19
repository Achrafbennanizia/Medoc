import { lazy, Suspense } from "react";
import { useT } from "@/lib/i18n";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./models/store/auth-store";
import { RoleRoute } from "./views/components/role-route";
import { DbSetupGate } from "./views/components/db-setup-gate";
import { LicenseAndPairingGate } from "./views/components/license-and-pairing-gate";
import { ClusterOnboardingGate } from "./views/components/cluster-onboarding-gate";
import { ClusterResetListener } from "./views/components/cluster-reset-listener";
import { ReplicaSyncBackground } from "./views/components/replica-sync-background";
import { PracticeWorkHoursBackground } from "./views/components/practice-work-hours-background";
import { SessionGate } from "./views/components/session-gate";
import { DesktopWindowFrame } from "./views/components/desktop-window-frame";
import { AppLayout } from "./views/layouts/app-layout";
import { PageLoading } from "@/views/components/ui/page-status";

const LoginPage = lazy(async () => ({ default: (await import("./views/pages/login")).LoginPage }));
const DashboardPage = lazy(async () => ({ default: (await import("./views/pages/dashboard")).DashboardPage }));
const AppointmentsPage = lazy(async () => ({ default: (await import("./views/pages/appointments")).AppointmentsPage }));
const AppointmentCreatePage = lazy(async () => ({ default: (await import("./views/pages/appointment-create")).AppointmentCreatePage }));
const PatientsPage = lazy(async () => ({ default: (await import("./views/pages/patients")).PatientsPage }));
const PatientDetailPage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/patient-detail/patient-detail")).PatientDetailPage }));
const ChartsToValidatePage = lazy(async () => ({
    default: (await import("@/systems/practice-host/pages/charts-to-validate")).ChartsToValidatePage,
}));
const PracticeTicketsPage = lazy(async () => ({
    default: (await import("./views/pages/practice-tickets")).PracticeTicketsPage,
}));
const PracticeTaskCreatePage = lazy(async () => ({
    default: (await import("./views/pages/practice-task-create")).PracticeTaskCreatePage,
}));
const PracticeTaskEditPage = lazy(async () => ({
    default: (await import("./views/pages/practice-task-edit")).PracticeTaskEditPage,
}));
const FinancePage = lazy(async () => ({ default: (await import("./views/pages/finance")).FinancePage }));
const FinanceCashPage = lazy(async () => ({ default: (await import("./views/pages/finance-cash")).FinanceCashPage }));
const PaymentCreatePage = lazy(async () => ({ default: (await import("./views/pages/payment-create")).PaymentCreatePage }));
const PaymentCashCreatePage = lazy(async () => ({
    default: (await import("./views/pages/payment-cash-create")).PaymentCashCreatePage,
}));
const ServicesPage = lazy(async () => ({ default: (await import("./views/pages/services")).ServicesPage }));
const ProductsPage = lazy(async () => ({ default: (await import("./views/pages/products")).ProductsPage }));
const StaffPage = lazy(async () => ({ default: (await import("./views/pages/staff")).StaffPage }));
const StaffWorkPlanPage = lazy(async () => ({
    default: (await import("./views/pages/staff-work-plan")).StaffWorkPlanPage,
}));
const WorkTimeTrackingPage = lazy(async () => ({
    default: (await import("./views/pages/work-time-tracking")).WorkTimeTrackingPage,
}));
const WorkTimeTeamPage = lazy(async () => ({
    default: (await import("./views/pages/work-time-team")).WorkTimeTeamPage,
}));
const StatisticsPage = lazy(async () => ({ default: (await import("./views/pages/statistics")).StatisticsPage }));
const AuditPage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/audit")).AuditPage }));
const LoggingPage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/logging")).LoggingPage }));
const OpsPage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/ops")).OpsPage }));
const CompliancePage = lazy(async () => ({ default: (await import("@/systems/practice-host/pages/compliance")).CompliancePage }));
const PrescriptionsPage = lazy(async () => ({ default: (await import("./views/pages/prescriptions")).PrescriptionsPage }));
const CertificatesPage = lazy(async () => ({ default: (await import("./views/pages/certificates")).CertificatesPage }));
const SettingsPage = lazy(async () => ({ default: (await import("./views/pages/settings")).SettingsPage }));
const PrivacyPage = lazy(async () => ({ default: (await import("./views/pages/privacy")).PrivacyPage }));
const BalanceSheetPage = lazy(async () => ({ default: (await import("./views/pages/balance-sheet")).BalanceSheetPage }));
const BalanceSheetNewPage = lazy(async () => ({ default: (await import("./views/pages/balance-sheet-new")).BalanceSheetNewPage }));
const AdministrationPage = lazy(async () => ({ default: (await import("./views/pages/administration")).AdministrationPage }));
const AdministrationFinanceToolsPage = lazy(async () => ({
    default: (await import("./views/pages/administration-finance-tools")).AdministrationFinanceToolsPage,
}));
const AdministrationFinanceBerichtePage = lazy(async () => ({
    default: (await import("./views/pages/administration-finance-reports")).AdministrationFinanceBerichtePage,
}));
const AdministrationTeamPage = lazy(async () => ({
    default: (await import("./views/pages/administration-team")).AdministrationTeamPage,
}));
const DayClosePage = lazy(async () => ({
    default: (await import("./views/pages/day-close")).DayClosePage,
}));
const AdministrationInventoryOrderingPage = lazy(async () => ({
    default: (await import("./views/pages/administration-inventory-ordering")).AdministrationInventoryOrderingPage,
}));
const AdministrationServicesKatalogeTemplatesPage = lazy(async () => ({
    default: (await import("./views/pages/administration-services-catalogs-templates")).AdministrationServicesKatalogeTemplatesPage,
}));
const AdministrationContractsPage = lazy(async () => ({
    default: (await import("./views/pages/administration-contracts")).AdministrationContractsPage,
}));
const TreatmentCatalogPage = lazy(async () => ({ default: (await import("./views/pages/treatment-catalog")).TreatmentCatalogPage }));
const SickLeaveCertificateFormPage = lazy(async () => ({
    default: (await import("./views/pages/sick-leave-certificate-administration")).SickLeaveCertificateFormPage,
}));
const OrderMasterAdministrationPage = lazy(async () => ({ default: (await import("./views/pages/order-master-administration")).OrderMasterAdministrationPage }));
const WorkDaysPage = lazy(async () => ({ default: (await import("./views/pages/work-days")).WorkDaysPage }));
const PracticePlanningPage = lazy(async () => ({ default: (await import("./views/pages/practice-planning")).PracticePlanningPage }));
const WorkHoursPage = lazy(async () => ({ default: (await import("./views/pages/work-hours")).WorkHoursPage }));
const SpecialBlockedTimesPage = lazy(async () => ({ default: (await import("./views/pages/special-blocks")).SpecialBlockedTimesPage }));
const PracticePreferencesPage = lazy(async () => ({ default: (await import("./views/pages/practice-preferences")).PracticePreferencesPage }));
const TemplatesPrescriptionsCertificatesPage = lazy(async () => ({ default: (await import("./views/pages/templates-prescriptions-certificates")).TemplatesPrescriptionsCertificatesPage }));
const TemplateEditorPage = lazy(async () => ({ default: (await import("./views/pages/template-editor")).TemplateEditorPage }));
const PatientCreatePage = lazy(async () => ({ default: (await import("./views/pages/patient-create")).PatientCreatePage }));
const PrescriptionCreatePage = lazy(async () => ({ default: (await import("./views/pages/prescription-create")).PrescriptionCreatePage }));
const PrescriptionEditPage = lazy(async () => ({ default: (await import("./views/pages/prescription-edit")).PrescriptionEditPage }));
const PurchaseOrdersPage = lazy(async () => ({ default: (await import("./views/pages/purchase-orders")).PurchaseOrdersPage }));
const PurchaseOrderCreatePage = lazy(async () => ({ default: (await import("./views/pages/purchase-order-create")).PurchaseOrderCreatePage }));
const PurchaseOrderDetailPage = lazy(async () => ({ default: (await import("./views/pages/purchase-order-detail")).PurchaseOrderDetailPage }));
const FeedbackPage = lazy(async () => ({ default: (await import("./views/pages/feedback")).FeedbackPage }));
const MigrationWizardPage = lazy(async () => ({ default: (await import("./views/pages/migration-wizard")).MigrationWizardPage }));
const HelpPage = lazy(async () => ({ default: (await import("./views/pages/help")).HelpPage }));
const LicenseActivateOnboardingPage = lazy(async () => ({
    default: (await import("@/systems/practice-host/pages/onboarding/license-activate")).LicenseActivateOnboardingPage,
}));
const AccountSetupOnboardingPage = lazy(async () => ({
    default: (await import("@/systems/practice-host/pages/onboarding/account-setup")).AccountSetupOnboardingPage,
}));
const SubscriptionRegisterOnboardingPage = lazy(async () => ({
    default: (await import("@/systems/practice-host/pages/onboarding/subscription-register"))
        .SubscriptionRegisterOnboardingPage,
}));
const ClusterJoinPage = lazy(async () => ({
    default: (await import("@/systems/lan/pages/cluster-join")).ClusterJoinPage,
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

export default function App() {
    return (
        <DbSetupGate>
        <SessionGate>
        <DesktopWindowFrame>
        <BrowserRouter>
        <ClusterResetListener />
        <ClusterOnboardingGate>
            <Routes>
                <Route
                    path="/onboarding"
                    element={<Navigate to="/onboarding/license" replace />}
                />
                <Route path="/onboarding/aktivierung" element={<Navigate to="/onboarding/license" replace />} />
                <Route path="/onboarding/abonnement" element={<Navigate to="/onboarding/subscription" replace />} />
                <Route path="/onboarding/konto" element={<Navigate to="/onboarding/account" replace />} />
                <Route path="/onboarding/beitreten" element={<Navigate to="/onboarding/join" replace />} />
                <Route
                    path="/onboarding/subscription"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <SubscriptionRegisterOnboardingPage />
                        </Suspense>
                    )}
                />
                <Route
                    path="/onboarding/account"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <AccountSetupOnboardingPage />
                        </Suspense>
                    )}
                />
                <Route
                    path="/onboarding/license"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <LicenseActivateOnboardingPage />
                        </Suspense>
                    )}
                />
                <Route
                    path="/onboarding/join"
                    element={(
                        <Suspense fallback={<RouteFallback />}>
                            <ClusterJoinPage />
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
                                <PracticeWorkHoursBackground />
                                <AppLayout />
                            </LicenseAndPairingGate>
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<RoleRoute routePath=""><DashboardPage /></RoleRoute>} />
                    <Route path="appointments" element={<RoleRoute routePath="appointments"><AppointmentsPage /></RoleRoute>} />
                    <Route path="appointments/new" element={<RoleRoute routePath="appointments/new"><AppointmentCreatePage /></RoleRoute>} />
                    <Route path="patients" element={<RoleRoute routePath="patients"><PatientsPage /></RoleRoute>} />
                    <Route path="patients/new" element={<RoleRoute routePath="patients/new"><PatientCreatePage /></RoleRoute>} />
                    <Route path="patients/:id/prescription/new" element={<RoleRoute routePath="patients/:id/prescription/new"><PrescriptionCreatePage /></RoleRoute>} />
                    <Route path="patients/:id/prescription/:prescriptionId" element={<RoleRoute routePath="patients/:id/prescription/:prescriptionId"><PrescriptionEditPage /></RoleRoute>} />
                    <Route path="patients/:id" element={<RoleRoute routePath="patients/:id"><PatientDetailPage /></RoleRoute>} />
                    <Route
                        path="charts/to-validate"
                        element={(
                            <RoleRoute routePath="charts/to-validate">
                                <ChartsToValidatePage />
                            </RoleRoute>
                        )}
                    />
                    <Route path="tickets/new" element={<RoleRoute routePath="tickets/new"><PracticeTaskCreatePage /></RoleRoute>} />
                    <Route path="tickets/:id/bearbeiten" element={<RoleRoute routePath="tickets/:id/bearbeiten"><PracticeTaskEditPage /></RoleRoute>} />
                    <Route path="tickets" element={<RoleRoute routePath="tickets"><PracticeTicketsPage /></RoleRoute>} />
                    <Route path="inbox" element={<Navigate to="/tickets" replace />} />
                    <Route path="finance" element={<RoleRoute routePath="finance"><FinancePage /></RoleRoute>} />
                    <Route path="finance/cash/new" element={<RoleRoute routePath="finance/cash/new"><PaymentCashCreatePage /></RoleRoute>} />
                    <Route path="finance/cash" element={<RoleRoute routePath="finance/cash"><FinanceCashPage /></RoleRoute>} />
                    <Route path="finance/new" element={<RoleRoute routePath="finance/new"><PaymentCreatePage /></RoleRoute>} />
                    <Route path="purchase-orders" element={<RoleRoute routePath="purchase-orders"><PurchaseOrdersPage /></RoleRoute>} />
                    <Route path="purchase-orders/new" element={<RoleRoute routePath="purchase-orders/new"><PurchaseOrderCreatePage /></RoleRoute>} />
                    <Route path="purchase-orders/:id" element={<RoleRoute routePath="purchase-orders/:id"><PurchaseOrderDetailPage /></RoleRoute>} />
                    <Route path="balance-sheet" element={<RoleRoute routePath="balance-sheet"><BalanceSheetPage /></RoleRoute>} />
                    <Route path="balance-sheet/new" element={<RoleRoute routePath="balance-sheet/new"><BalanceSheetNewPage /></RoleRoute>} />
                    <Route path="administration" element={<RoleRoute routePath="administration"><AdministrationPage /></RoleRoute>} />
                    <Route
                        path="administration/team"
                        element={(
                            <RoleRoute routePath="administration/team">
                                <AdministrationTeamPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="administration/team/work-time"
                        element={(
                            <RoleRoute routePath="administration/team/work-time">
                                <WorkTimeTeamPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="administration/tasks"
                        element={<Navigate to="/tickets?tab=verwalten" replace />}
                    />
                    <Route path="administration/work-days" element={<RoleRoute routePath="administration/work-days"><WorkDaysPage /></RoleRoute>} />
                    <Route path="administration/practice-planning" element={<RoleRoute routePath="administration/practice-planning"><PracticePlanningPage /></RoleRoute>} />
                    <Route path="administration/work-hours" element={<RoleRoute routePath="administration/work-hours"><WorkHoursPage /></RoleRoute>} />
                    <Route path="administration/special-blocked-times" element={<RoleRoute routePath="administration/special-blocked-times"><SpecialBlockedTimesPage /></RoleRoute>} />
                    <Route path="administration/practice-preferences" element={<RoleRoute routePath="administration/practice-preferences"><PracticePreferencesPage /></RoleRoute>} />
                    <Route path="administration/templates" element={<RoleRoute routePath="administration/templates"><TemplatesPrescriptionsCertificatesPage /></RoleRoute>} />
                    <Route path="administration/templates/editor/:id" element={<RoleRoute routePath="administration/templates/editor"><TemplateEditorPage /></RoleRoute>} />
                    <Route path="administration/templates/editor" element={<RoleRoute routePath="administration/templates/editor"><TemplateEditorPage /></RoleRoute>} />
                    <Route path="administration/treatment-catalog" element={<RoleRoute routePath="administration/treatment-catalog"><TreatmentCatalogPage /></RoleRoute>} />
                    <Route path="administration/order-master" element={<RoleRoute routePath="administration/order-master"><OrderMasterAdministrationPage /></RoleRoute>} />
                    <Route
                        path="administration/finance-reports"
                        element={(
                            <RoleRoute routePath="administration/finance-reports">
                                <AdministrationFinanceBerichtePage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="administration/finance-reports/day-close"
                        element={(
                            <RoleRoute routePath="administration/finance-reports/day-close">
                                <DayClosePage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="administration/finance-reports/invoice"
                        element={(
                            <RoleRoute routePath="administration/finance-reports/invoice">
                                <AdministrationFinanceToolsPage />
                            </RoleRoute>
                        )}
                    />
                    <Route path="administration/day-close" element={<Navigate to="/administration/finance-reports/day-close" replace />} />
                    <Route path="administration/finance-tools" element={<Navigate to="/administration/finance-reports/invoice" replace />} />
                    <Route
                        path="administration/inventory-and-ordering"
                        element={(
                            <RoleRoute routePath="administration/inventory-and-ordering">
                                <AdministrationInventoryOrderingPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="administration/contracts"
                        element={(
                            <RoleRoute routePath="administration/contracts">
                                <AdministrationContractsPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="administration/services-catalogs-templates"
                        element={(
                            <RoleRoute routePath="administration/services-catalogs-templates">
                                <AdministrationServicesKatalogeTemplatesPage />
                            </RoleRoute>
                        )}
                    />
                    <Route path="prescriptions" element={<RoleRoute routePath="prescriptions"><PrescriptionsPage /></RoleRoute>} />
                    <Route path="certificates" element={<RoleRoute routePath="certificates"><CertificatesPage /></RoleRoute>} />
                    <Route path="services" element={<RoleRoute routePath="services"><ServicesPage /></RoleRoute>} />
                    <Route
                        path="services/new"
                        element={(
                            <RoleRoute routePath="services/new">
                                <Navigate to="/services?new=1" replace />
                            </RoleRoute>
                        )}
                    />
                    <Route path="products" element={<RoleRoute routePath="products"><ProductsPage /></RoleRoute>} />
                    <Route path="staff" element={<RoleRoute routePath="staff"><StaffPage /></RoleRoute>} />
                    <Route
                        path="staff/work-plan"
                        element={(
                            <RoleRoute routePath="staff/work-plan">
                                <StaffWorkPlanPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="staff/work-time"
                        element={(
                            <RoleRoute routePath="staff/work-time">
                                <WorkTimeTrackingPage />
                            </RoleRoute>
                        )}
                    />
                    <Route
                        path="administration/sick-leave-certificate"
                        element={(
                            <RoleRoute routePath="administration/sick-leave-certificate">
                                <SickLeaveCertificateFormPage />
                            </RoleRoute>
                        )}
                    />
                    <Route path="staff/new" element={<RoleRoute routePath="staff/new"><Navigate to="/staff?new=1" replace /></RoleRoute>} />
                    <Route path="statistics" element={<RoleRoute routePath="statistics"><StatisticsPage /></RoleRoute>} />
                    <Route path="audit" element={<RoleRoute routePath="audit"><AuditPage /></RoleRoute>} />
                    <Route path="privacy" element={<RoleRoute routePath="privacy"><PrivacyPage /></RoleRoute>} />
                    <Route path="settings" element={<RoleRoute routePath="settings"><SettingsPage /></RoleRoute>} />
                    <Route path="logs" element={<RoleRoute routePath="logs"><LoggingPage /></RoleRoute>} />
                    <Route path="ops" element={<RoleRoute routePath="ops"><OpsPage /></RoleRoute>} />
                    <Route path="compliance" element={<RoleRoute routePath="compliance"><CompliancePage /></RoleRoute>} />
                    <Route path="help" element={<RoleRoute routePath="help"><Suspense fallback={<RouteFallback />}><HelpPage /></Suspense></RoleRoute>} />
                    <Route path="hilfe" element={<Navigate to="/help" replace />} />
                    <Route path="feedback" element={<RoleRoute routePath="feedback"><FeedbackPage /></RoleRoute>} />
                    <Route path="migration" element={<RoleRoute routePath="migration"><MigrationWizardPage /></RoleRoute>} />
                </Route>
            </Routes>
        </ClusterOnboardingGate>
        </BrowserRouter>
        </DesktopWindowFrame>
        </SessionGate>
        </DbSetupGate>
    );
}
