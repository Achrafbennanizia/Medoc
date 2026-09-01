#!/usr/bin/env python3
"""Apply remaining TypeScript/React identifier conversions."""
from __future__ import annotations

from pathlib import Path

ROOT = Path("/Users/achraf/pro/Medoc")

# (path, replacements) — only applied if the file exists
BATCH: list[tuple[str, list[tuple[str, str]]]] = [
    (
        "apps/practice-host-ui/src/views/pages/help.tsx",
        [
            ("export type HilfePageProps", "export type HelpPageProps"),
            ("export function HilfePage({ embedded = false }: HilfePageProps", "export function HelpPage({ embedded = false }: HelpPageProps"),
            ('t("page.hilfe.', 't("page.help.'),
        ],
    ),
    (
        "apps/practice-host-ui/src/App.tsx",
        [
            ("const HilfePage = lazy(async () => ({ default: (await import(\"./views/pages/help\")).HilfePage }));",
             "const HelpPage = lazy(async () => ({ default: (await import(\"./views/pages/help\")).HelpPage }));"),
            ('<Route path="hilfe" element={<RoleRoute routePath="hilfe"><Suspense fallback={<RouteFallback />}><HilfePage /></Suspense></RoleRoute>} />',
             '<Route path="help" element={<RoleRoute routePath="help"><Suspense fallback={<RouteFallback />}><HelpPage /></Suspense></RoleRoute>} />'),
            ("LicenseAktivierenOnboardingPage", "LicenseActivateOnboardingPage"),
            ("KontoEinrichtenOnboardingPage", "AccountSetupOnboardingPage"),
            ("AbonnementRegistrierenOnboardingPage", "SubscriptionRegisterOnboardingPage"),
            ("ClusterBeitretenPage", "ClusterJoinPage"),
            ('path="/onboarding/abonnement"', 'path="/onboarding/subscription"'),
            ('path="/onboarding/konto"', 'path="/onboarding/account"'),
            ('path="/onboarding/beitreten"', 'path="/onboarding/join"'),
        ],
    ),
    (
        "packages/shared/src/lib/command-palette-data.ts",
        [
            ('cmd("hilfe", "hilfe", "/hilfe", ["help", "shortcuts", "keyboard"]),',
             'cmd("help", "help", "/help", ["help", "shortcuts", "keyboard"]),'),
        ],
    ),
    (
        "packages/shared/src/lib/native-go-menu.ts",
        [
            ('"/hilfe": "nav.hilfe",', '"/help": "nav.help",'),
            ('["/hilfe", "/feedback"],', '["/help", "/feedback"],'),
        ],
    ),
    (
        "packages/shared/src/lib/breadcrumb-keys.ts",
        [
            ('"/hilfe": [APP, "nav.hilfe"],', '"/help": [APP, "nav.help"],'),
        ],
    ),
    (
        "packages/shared/src/lib/icons.tsx",
        [
            ('"/hilfe": HelpCircleIconImpl,', '"/help": HelpCircleIconImpl,'),
        ],
    ),
    (
        "packages/shared/src/lib/rbac.ts",
        [
            ("    hilfe: { kind: \"action\", action: \"dashboard.read\" },",
             "    help: { kind: \"action\", action: \"dashboard.read\" },"),
            ('    | "konto"\n', '    | "account"\n'),
            ('    | "sicherheit"\n', '    | "security"\n'),
            ('    | "darstellung"\n', '    | "appearance"\n'),
            ('    | "arbeitsablaeufe"\n', '    | "workflows"\n'),
            ('    "sicherheit": { kind: "action", action: "ops.system" },',
             '    security: { kind: "action", action: "ops.system" },'),
            ('        "konto",', '        "account",'),
            ('        "darstellung",', '        "appearance",'),
            ('        "arbeitsablaeufe",', '        "workflows",'),
        ],
    ),
    (
        "packages/shared/src/lib/rbac.test.ts",
        [
            ('    it("allows hilfe and feedback for active roles", () => {',
             '    it("allows help and feedback for active roles", () => {'),
            ('        expect(routeChildPathAllowed("hilfe", "PHYSICIAN")).toBe(true);',
             '        expect(routeChildPathAllowed("help", "PHYSICIAN")).toBe(true);'),
            ('        expect(settingsSectionVisible("sicherheit", "RECEPTION")).toBe(false);',
             '        expect(settingsSectionVisible("security", "RECEPTION")).toBe(false);'),
            ('        expect(settingsSectionVisible("konto", "RECEPTION")).toBe(true);',
             '        expect(settingsSectionVisible("account", "RECEPTION")).toBe(true);'),
            ('        expect(settingsSectionVisible("darstellung", "RECEPTION")).toBe(true);',
             '        expect(settingsSectionVisible("appearance", "RECEPTION")).toBe(true);'),
            ('        expect(settingsSectionVisible("arbeitsablaeufe", "RECEPTION")).toBe(true);',
             '        expect(settingsSectionVisible("workflows", "RECEPTION")).toBe(true);'),
            ('    it("shows practice and sicherheit for PHYSICIAN", () => {',
             '    it("shows practice and security for PHYSICIAN", () => {'),
            ('        expect(settingsSectionVisible("sicherheit", "PHYSICIAN")).toBe(true);',
             '        expect(settingsSectionVisible("security", "PHYSICIAN")).toBe(true);'),
        ],
    ),
    (
        "apps/practice-host-ui/src/views/pages/settings.tsx",
        [
            ("SettingsDarstellungSection", "SettingsAppearanceSection"),
            ("SettingsArbeitsablaeufeSection", "SettingsWorkflowsSection"),
            ("SettingsKontoSection", "SettingsAccountSection"),
            ("SettingsSicherheitSection", "SettingsSecuritySection"),
            ("SettingsIntegrationenSection", "SettingsIntegrationsSection"),
            ("    konto: \"konto\",", "    account: \"account\","),
            ("    sicherheit: \"sicherheit\",", "    security: \"security\","),
            ("    darstellung: \"darstellung\",", "    appearance: \"appearance\","),
            ("    arbeitsablaeufe: \"arbeitsablaeufe\",", "    workflows: \"workflows\","),
            ('        if (searchParams.get("tab") === "hilfe") {',
             '        if (searchParams.get("tab") === "hilfe" || searchParams.get("tab") === "help") {'),
            ('            navigate("/hilfe", { replace: true });',
             '            navigate("/help", { replace: true });'),
            ('        { id: "konto", labelKey: "settings.nav.konto", icon: UsersIcon },',
             '        { id: "account", labelKey: "settings.nav.account", icon: UsersIcon },'),
            ('        { id: "sicherheit", labelKey: "settings.nav.sicherheit", icon: ShieldIcon },',
             '        { id: "security", labelKey: "settings.nav.security", icon: ShieldIcon },'),
            ('        { id: "darstellung", labelKey: "settings.nav.darstellung", icon: SunIcon },',
             '        { id: "appearance", labelKey: "settings.nav.appearance", icon: SunIcon },'),
            ('        { id: "arbeitsablaeufe", labelKey: "settings.nav.arbeitsablaeufe", icon: SlidersHorizontalIcon },',
             '        { id: "workflows", labelKey: "settings.nav.workflows", icon: SlidersHorizontalIcon },'),
            ('onOpenArbeitsablaeufe={() => setSection("arbeitsablaeufe")}',
             'onOpenWorkflows={() => setSection("workflows")}'),
            ('activeSection === "konto"', 'activeSection === "account"'),
            ('activeSection === "sicherheit"', 'activeSection === "security"'),
            ('activeSection === "darstellung"', 'activeSection === "appearance"'),
            ('activeSection === "arbeitsablaeufe"', 'activeSection === "workflows"'),
        ],
    ),
    (
        "apps/practice-host-ui/src/views/pages/settings.rbac.smoke.test.tsx",
        [
            ("SettingsKontoSection: () => <div data-testid=\"konto-panel\">Konto</div>,",
             "SettingsAccountSection: () => <div data-testid=\"account-panel\">Account</div>,"),
        ],
    ),
    (
        "apps/practice-host-ui/src/views/pages/feedback.tsx",
        [('navigate("/hilfe")', 'navigate("/help")')],
    ),
    (
        "packages/app/practice-host/src/pages/compliance.tsx",
        [('navigate("/hilfe")', 'navigate("/help")')],
    ),
    (
        "apps/practice-host-ui/src/views/layouts/app-layout.tsx",
        [('navigate("/hilfe")', 'navigate("/help")')],
    ),
    (
        "packages/shared/src/lib/report-export.ts",
        [
            ("    einnM: number;\n    einnDeltaPct: number | null;\n    st: number;\n    offeneN: number;\n    offeneSum: number;\n    gew: number;",
             "    incomeMtd: number;\n    incomeDeltaPct: number | null;\n    st: number;\n    openCount: number;\n    openSum: number;\n    profitMtd: number;"),
            ("formatCurrency(kpi.einnM)", "formatCurrency(kpi.incomeMtd)"),
            ("formatCurrency(kpi.gew)", "formatCurrency(kpi.profitMtd)"),
            ("`${kpi.offeneN} (${formatCurrency(kpi.offeneSum)})`", "`${kpi.openCount} (${formatCurrency(kpi.openSum)})`"),
        ],
    ),
    (
        "packages/shared/src/lib/report-export.test.ts",
        [
            ("{ einnM: 100, einnDeltaPct: null, st: 0, offeneN: 0, offeneSum: 0, gew: 100 }",
             "{ incomeMtd: 100, incomeDeltaPct: null, st: 0, openCount: 0, openSum: 0, profitMtd: 100 }"),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/onboarding/account-setup.tsx",
        [
            ("export function KontoEinrichtenOnboardingPage()", "export function AccountSetupOnboardingPage()"),
            ('to="/onboarding/beitreten"', 'to="/onboarding/join"'),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/onboarding/license-activate.tsx",
        [
            ("export function LicenseAktivierenOnboardingPage()", "export function LicenseActivateOnboardingPage()"),
            ('navigate("/onboarding/abonnement"', 'navigate("/onboarding/subscription"'),
            ('to="/onboarding/beitreten"', 'to="/onboarding/join"'),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/onboarding/subscription-register.tsx",
        [
            ("export function AbonnementRegistrierenOnboardingPage()", "export function SubscriptionRegisterOnboardingPage()"),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/onboarding/activation-import.tsx",
        [
            ('navigate("/onboarding/abonnement"', 'navigate("/onboarding/subscription"'),
        ],
    ),
    (
        "packages/server/lan/src/pages/cluster-join.tsx",
        [
            ("export function ClusterBeitretenPage()", "export function ClusterJoinPage()"),
        ],
    ),
    (
        "packages/app/practice-host/src/components/cluster-join-flow.tsx",
        [
            ('navigate("/onboarding/konto"', 'navigate("/onboarding/account"'),
        ],
    ),
    (
        "apps/practice-host-ui/src/views/components/cluster-onboarding-gate.tsx",
        [
            ("const onBeitreten = path === \"/onboarding/beitreten\";",
             "const onJoin = path === \"/onboarding/join\" || path === \"/onboarding/beitreten\";"),
            ("const onAbonnement = path === \"/onboarding/abonnement\";",
             "const onSubscription = path === \"/onboarding/subscription\" || path === \"/onboarding/abonnement\";"),
            ("const onKonto = path === \"/onboarding/konto\";",
             "const onAccount = path === \"/onboarding/account\" || path === \"/onboarding/konto\";"),
            ("&& !onLicense && !onBeitreten", "&& !onLicense && !onJoin"),
            ("if (needsPracticeSetup && !onAbonnement)", "if (needsPracticeSetup && !onSubscription)"),
            ('return <Navigate to="/onboarding/abonnement" replace />;',
             'return <Navigate to="/onboarding/subscription" replace />;'),
            ("if (needsMemberAccount && !session && !onKonto && !onLogin)",
             "if (needsMemberAccount && !session && !onAccount && !onLogin)"),
            ('return <Navigate to="/onboarding/konto" replace />;',
             'return <Navigate to="/onboarding/account" replace />;'),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/settings/settings-account-section.tsx",
        [
            ("SettingsKontoSectionProps", "SettingsAccountSectionProps"),
            ("export function SettingsKontoSection(", "export function SettingsAccountSection("),
            ('t("settings.konto.', 't("settings.account.'),
            ("tp(\"settings.konto.", "tp(\"settings.account."),
            ("kontoProfileLoading", "accountProfileLoading"),
            ("setKontoProfileLoading", "setAccountProfileLoading"),
            ("kontoSaveNameBusy", "accountSaveNameBusy"),
            ("setKontoSaveNameBusy", "setAccountSaveNameBusy"),
            ("kontoSaveEmailBusy", "accountSaveEmailBusy"),
            ("setKontoSaveEmailBusy", "setAccountSaveEmailBusy"),
            ("kontoSavePhoneBusy", "accountSavePhoneBusy"),
            ("setKontoSavePhoneBusy", "setAccountSavePhoneBusy"),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/settings/settings-security-section.tsx",
        [
            ("export function SettingsSicherheitSection(", "export function SettingsSecuritySection("),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/settings/settings-appearance-section.tsx",
        [
            ("export function SettingsDarstellungSection(", "export function SettingsAppearanceSection("),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/settings/settings-workflows-section.tsx",
        [
            ("export function SettingsArbeitsablaeufeSection(", "export function SettingsWorkflowsSection("),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/settings/settings-integrations-section.tsx",
        [
            ("export function SettingsIntegrationenSection(", "export function SettingsIntegrationsSection("),
        ],
    ),
    (
        "packages/app/practice-host/src/pages/settings/settings-practice-section.tsx",
        [
            ("onOpenArbeitsablaeufe: () => void;", "onOpenWorkflows: () => void;"),
            ("onOpenArbeitsablaeufe,", "onOpenWorkflows,"),
            ("onOpenArbeitsablaeufe()", "onOpenWorkflows()"),
        ],
    ),
]


def apply(rel: str, pairs: list[tuple[str, str]]) -> None:
    path = ROOT / rel
    if not path.exists():
        print(f"SKIP missing {rel}")
        return
    text = path.read_text()
    orig = text
    missing = []
    for a, b in pairs:
        if a not in text:
            missing.append(a[:80])
        else:
            text = text.replace(a, b)
    if text != orig:
        path.write_text(text)
        print(f"updated {rel}")
    else:
        print(f"unchanged {rel}")
    if missing:
        for m in missing:
            print(f"  MISSING in {rel}: {m!r}")


def main() -> None:
    for rel, pairs in BATCH:
        apply(rel, pairs)


if __name__ == "__main__":
    main()
