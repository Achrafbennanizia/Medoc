import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { clockLastSampleAt, clockOffsetMs, useNow } from "@/lib/practice-clock";
import { formatDateTime } from "@/lib/utils";
import { AboutAppDialog } from "../app-help-dialogs";
import { Button } from "../ui/button";

function formatOffset(ms: number): string {
    const s = Math.round(ms / 1000);
    const sign = s < 0 ? "−" : "+";
    const abs = Math.abs(s);
    return abs >= 60 ? `${sign}${Math.floor(abs / 60)} min ${abs % 60} s` : `${sign}${abs} s`;
}

export function HelpAbout({ links }: { links?: ReactNode }) {
    const t = useT();
    const now = useNow(1000);
    const [aboutOpen, setAboutOpen] = useState(false);
    const synced = clockLastSampleAt() > 0;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return (
        <div className="help-stack">
            <dl className="help-facts">
                <div>
                    <dt>{t("help.about.version")}</dt>
                    <dd>{import.meta.env.VITE_APP_VERSION ?? "—"}</dd>
                </div>
                <div>
                    <dt>{t("help.about.time_source")}</dt>
                    <dd>
                        {formatDateTime(now.toISOString())} ·{" "}
                        {synced ? t("help.about.time_synced").replace("{offset}", formatOffset(clockOffsetMs())) : t("help.about.time_local")}
                    </dd>
                </div>
                <div>
                    <dt>{t("help.about.timezone")}</dt>
                    <dd>{tz}</dd>
                </div>
            </dl>
            <div className="help-toolbar__actions">
                <Button type="button" variant="secondary" onClick={() => setAboutOpen(true)}>
                    {t("page.help.about_app")}
                </Button>
                {links}
            </div>
            <AboutAppDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
        </div>
    );
}
