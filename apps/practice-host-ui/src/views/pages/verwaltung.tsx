import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

export function VerwaltungPage() {
    const t = useT();
    const links = useMemo<VerwaltungTocLink[]>(
        () => [
            {
                title: t("page.verwaltung.link_team_title"),
                desc: t("page.verwaltung.link_team_desc"),
                href: "/verwaltung/team",
                iconKey: "/personal",
                requires: "verwaltung/team",
            },
            {
                title: t("page.verwaltung.link_finanzen_title"),
                desc: t("page.verwaltung.link_finanzen_desc"),
                href: "/verwaltung/finanzen-berichte",
                iconKey: "/finanzen",
                requires: "verwaltung/finanzen-berichte",
            },
            {
                title: t("page.verwaltung.link_lager_title"),
                desc: t("page.verwaltung.link_lager_desc"),
                href: "/verwaltung/lager-und-bestellwesen",
                iconKey: "/produkte",
                requires: "verwaltung/lager-und-bestellwesen",
            },
            {
                title: t("page.verwaltung.link_leistungen_title"),
                desc: t("page.verwaltung.link_leistungen_desc"),
                href: "/verwaltung/leistungen-kataloge-vorlagen",
                iconKey: "/leistungen",
                requires: "verwaltung/leistungen-kataloge-vorlagen",
            },
            {
                title: t("page.verwaltung.link_praxis_title"),
                desc: t("page.verwaltung.link_praxis_desc"),
                href: "/verwaltung/praxisplanung",
                iconKey: "/termine",
                requires: "verwaltung/praxisplanung",
            },
        ],
        [t],
    );

    return (
        <VerwaltungTocPage
            title={t("page.verwaltung.title")}
            subtitle={t("page.verwaltung.subtitle")}
            links={links}
        />
    );
}
