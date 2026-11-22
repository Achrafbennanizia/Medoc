/**
 * Help → About & support: composes the sections in ./about/. Each section file owns one part of the page;
 * this component only loads the live status once and passes it down.
 */
import { useMemo, type ReactNode } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { clockLastSampleAt, clockOffsetMs, useNow } from "@/lib/practice-clock";
import { effectiveZoom, normalizeDisplayPreferences, TEXT_SCALE_NAMES } from "@/lib/display-preferences";
import { loadClientSettings } from "@/lib/client-settings";
import { recentErrors } from "@/lib/errors";
import { resolveDesktopChromeMode } from "../resolve-desktop-chrome-mode";
import { AboutDataSection } from "./about/about-data-section";
import { AboutDeviceSection } from "./about/about-device-section";
import { buildDiagnostics } from "./about/about-diagnostics";
import { AboutLegalSection } from "./about/about-legal-section";
import { AboutNav } from "./about/about-nav";
import { useActiveAboutSection } from "./about/use-active-about-section";
import { AboutNetworkSection } from "./about/about-network-section";
import { AboutOverviewSection } from "./about/about-overview-section";
import { useAboutStatus } from "./about/about-status";
import { AboutSupportSection } from "./about/about-support-section";

export function HelpAbout({ links, onOpenRecentErrors }: { links?: ReactNode; onOpenRecentErrors?: () => void }) {
    const t = useT();
    const locale = useLocale((s) => s.locale);
    const now = useNow(1000);
    const { status, refresh, loading } = useAboutStatus();
    const { active, go } = useActiveAboutSection();
    const chrome = useMemo(() => resolveDesktopChromeMode(), []);

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const textSizeName = TEXT_SCALE_NAMES[normalizeDisplayPreferences(loadClientSettings().appearance?.display).textScale];
    const zoomPct = Math.round(effectiveZoom() * 100);
    const errors = recentErrors();
    const version = status.version.state === "ok" ? status.version.value : "—";
    const role = status.sync.state !== "ok" ? "—" : status.sync.value.deployment.role === "REPLICA" ? t("help.about.role.replica") : t("help.about.role.main");

    const diagnostics = () =>
        buildDiagnostics({
            status,
            version,
            devBuild: import.meta.env.DEV,
            platform: `${chrome} · ${navigator.platform}`,
            screen: { width: window.screen.width, height: window.screen.height },
            locale,
            textSize: textSizeName,
            zoomPct,
            now,
            timeZone,
            clockOffsetMs: clockLastSampleAt() > 0 ? clockOffsetMs() : null,
            errors,
        });

    return (
        <div className="about-layout">
            <AboutNav active={active} onGo={go} onRefresh={refresh} loading={loading} loadedAt={status.loadedAt} />
            <div className="about-content">
                <AboutOverviewSection status={status} version={version} role={role} nowMs={now.getTime()} onGo={go} />
                <AboutDeviceSection status={status} chrome={chrome} textSizeName={textSizeName} zoomPct={zoomPct} now={now} timeZone={timeZone} />
                <AboutNetworkSection status={status} role={role} nowMs={now.getTime()} />
                <AboutDataSection status={status} />
                <AboutSupportSection diagnostics={diagnostics} errorCount={errors.length} onOpenRecentErrors={onOpenRecentErrors} links={links} />
                <AboutLegalSection version={version} />
            </div>
        </div>
    );
}
