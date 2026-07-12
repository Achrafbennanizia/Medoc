import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

/** Submenu "Team" under Verwaltung — same pattern page as "Finanzen & Berichte". */
export function VerwaltungTeamPage() {
    const t = useT();
    const links = useMemo<VerwaltungTocLink[]>(
        () => [
            {
                title: t("page.verwaltung_team.link_personal_title"),
                desc: t("page.verwaltung_team.link_personal_desc"),
                href: "/personal",
                iconKey: "/personal",
                requires: "personal",
            },
            {
                title: t("page.verwaltung_team.link_arbeitsplan_title"),
                desc: t("page.verwaltung_team.link_arbeitsplan_desc"),
                href: "/personal/arbeitsplan",
                iconKey: "Calendar",
                requires: "personal/arbeitsplan",
            },
            {
                title: t("page.verwaltung_team.link_team_work_time_title"),
                desc: t("page.verwaltung_team.link_team_work_time_desc"),
                href: "/verwaltung/team/arbeitszeit",
                iconKey: "Clock",
                requires: "verwaltung/team/arbeitszeit",
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
