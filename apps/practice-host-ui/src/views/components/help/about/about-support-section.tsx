/** Getting help: the steps, copy diagnostics, recent errors and the related pages. */
import type { ReactNode } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { Button } from "../../ui/button";
import { useToastStore } from "../../ui/toast-store";
import { AboutSection } from "./about-primitives";

type Props = { diagnostics: () => string; errorCount: number; onOpenRecentErrors?: () => void; links?: ReactNode };

const STEPS = ["search", "code", "copy", "contact"] as const;

export function AboutSupportSection({ diagnostics, errorCount, onOpenRecentErrors, links }: Props) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(diagnostics());
            toast(t("help.about.copied"), "success");
        } catch {
            toast(t("help.about.copy_failed"), "error");
        }
    };
    return (
        <AboutSection id="support" intro={t("help.about.support_intro")}>
            <ol className="about-steps">
                {STEPS.map((s) => (
                    <li key={s}>{t(`help.about.step.${s}`)}</li>
                ))}
            </ol>
            <div className="help-toolbar__actions">
                <Button type="button" onClick={() => void copy()}>
                    {t("help.about.copy_diagnostics")}
                </Button>
                {onOpenRecentErrors ? (
                    <Button type="button" variant="secondary" onClick={onOpenRecentErrors}>
                        {tp("help.about.recent_errors", { count: errorCount })}
                    </Button>
                ) : null}
                {links}
            </div>
            <p className="about-muted">{t("help.about.privacy_note")}</p>
        </AboutSection>
    );
}
