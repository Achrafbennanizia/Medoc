import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

export function PraxisplanungPage() {
    const t = useT();
    const links = useMemo<VerwaltungTocLink[]>(
        () => [
            {
                title: t("page.praxisplanung.link_arbeitstage_title"),
                desc: t("page.praxisplanung.link_arbeitstage_desc"),
                href: "/verwaltung/arbeitstage",
                requires: "verwaltung/arbeitstage",
            },
            {
                title: t("page.praxisplanung.link_sperrzeiten_title"),
                desc: t("page.praxisplanung.link_sperrzeiten_desc"),
                href: "/verwaltung/sonder-sperrzeiten",
                requires: "verwaltung/sonder-sperrzeiten",
            },
            {
                title: t("page.praxisplanung.link_arbeitszeiten_title"),
                desc: t("page.praxisplanung.link_arbeitszeiten_desc"),
                href: "/verwaltung/arbeitszeiten",
                requires: "verwaltung/arbeitszeiten",
            },
            {
                title: t("page.praxisplanung.link_praeferenzen_title"),
                desc: t("page.praxisplanung.link_praeferenzen_desc"),
                href: "/verwaltung/praxis-praeferenzen",
                requires: "verwaltung/praxis-praeferenzen",
            },
        ],
        [t],
    );

    return (
        <VerwaltungTocPage
            title={t("page.praxisplanung.title")}
            subtitle={t("page.praxisplanung.subtitle")}
            links={links}
        />
    );
}
