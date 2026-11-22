/** Product & licences: description, third-party notices and the About dialog. */
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { AboutAppDialog } from "../../app-help-dialogs";
import { Button } from "../../ui/button";
import { AboutSection } from "./about-primitives";

export function AboutLegalSection({ version }: { version: string }) {
    const t = useT();
    const [open, setOpen] = useState(false);
    return (
        <AboutSection id="legal">
            <p>{t("app.help.about_description")}</p>
            <p className="about-muted">
                {t("app.help.about_symbols")}{" "}
                <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                    Lucide
                </a>{" "}
                {t("app.help.about_symbols_license")}
            </p>
            <div className="help-toolbar__actions">
                <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
                    {t("page.help.about_app")}
                </Button>
            </div>
            <AboutAppDialog open={open} onClose={() => setOpen(false)} appVersion={version} />
        </AboutSection>
    );
}
