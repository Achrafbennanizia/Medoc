/** This device: platform, id, language, text size, screen, clock and time zone. */
import { useLocale, useT, useTParams } from "@/lib/i18n";
import { clockLastSampleAt, clockOffsetMs } from "@/lib/practice-clock";
import { formatDateTime } from "@/lib/utils";
import type { DesktopChromeMode } from "../../resolve-desktop-chrome-mode";
import { formatOffset } from "./about-format";
import { AboutSection, Fact, Val } from "./about-primitives";
import { shortId, type AboutStatus } from "./about-status";

type Props = { status: AboutStatus; chrome: DesktopChromeMode; textSizeName: string; zoomPct: number; now: Date; timeZone: string };

export function AboutDeviceSection({ status, chrome, textSizeName, zoomPct, now, timeZone }: Props) {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const clock = clockLastSampleAt() > 0 ? t("help.about.time_synced").replace("{offset}", formatOffset(clockOffsetMs())) : t("help.about.time_local");
    return (
        <AboutSection id="device">
            <dl className="help-facts">
                <Fact label={t("help.about.platform")}>{t(`help.about.chrome.${chrome}`)}</Fact>
                <Fact label={t("help.about.device_id")}>
                    <Val v={status.sync}>{(s) => <code>{shortId(s.localDeviceId)}</code>}</Val>
                </Fact>
                <Fact label={t("help.about.language")}>{t(`settings.appearance.language.option.${locale}`)}</Fact>
                <Fact label={t("help.about.text_size")}>
                    {tp("help.about.text_size_value", { name: t(`settings.a11y.text_size.${textSizeName}`), zoom: zoomPct })}
                </Fact>
                <Fact label={t("help.about.screen")}>{`${window.screen.width} × ${window.screen.height}`}</Fact>
                <Fact label={t("help.about.time_source")}>{`${formatDateTime(now.toISOString())} · ${clock}`}</Fact>
                <Fact label={t("help.about.timezone")}>{timeZone}</Fact>
            </dl>
        </AboutSection>
    );
}
