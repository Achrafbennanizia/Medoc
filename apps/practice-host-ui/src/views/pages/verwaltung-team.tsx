import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

/** Untermenü „Team“ unter Verwaltung — gleiche Musterseite wie „Finanzen & Berichte“. */
export function VerwaltungTeamPage() {
    const t = useT();
    const links = useMemo<VerwaltungTocLink[]>(
        () => [
            {
                title: t("page.verwaltung_team.link_personal_title"),
                desc: t("page.verwaltung_team.link_personal_desc"),
                href: "/personal",
                requires: "personal",
            },
            {
                title: t("page.verwaltung_team.link_arbeitsplan_title"),
                desc: t("page.verwaltung_team.link_arbeitsplan_desc"),
                href: "/personal/arbeitsplan",
                requires: "personal/arbeitsplan",
            },
        ],
        [t],
    );

    return (
        <VerwaltungTocPage
            title={t("page.verwaltung_team.title")}
            subtitle={t("verwaltung.team.subtitle")}
            links={links}
        />
    );
}
