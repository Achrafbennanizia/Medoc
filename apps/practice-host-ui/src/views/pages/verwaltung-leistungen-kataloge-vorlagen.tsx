import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { LEISTUNGEN_MENU_ENABLED, REZEPTE_ATTESTE_MENU_ENABLED } from "@/lib/catalog-menu-flags";
import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

/** Services, catalogs, templates — table in card. */
export function VerwaltungLeistungenKatalogeVorlagenPage() {
    const t = useT();
    const links = useMemo<VerwaltungTocLink[]>(
        () => [
            /* MVP blind — Leistungen (`LEISTUNGEN_MENU_ENABLED` in catalog-menu-flags.ts)
            {
                title: t("page.verwaltung_leistungen.link_leistungen_title"),
                desc: t("page.verwaltung_leistungen.link_leistungen_desc"),
                href: "/leistungen",
                requires: "leistungen",
            },
            */
            ...(LEISTUNGEN_MENU_ENABLED
                ? [
                      {
                          title: t("page.verwaltung_leistungen.link_leistungen_title"),
                          desc: t("page.verwaltung_leistungen.link_leistungen_desc"),
                          href: "/leistungen",
                          requires: "leistungen",
                      },
                  ]
                : []),
            {
                title: t("page.verwaltung_leistungen.link_behandlung_title"),
                desc: t("page.verwaltung_leistungen.link_behandlung_desc"),
                href: "/verwaltung/behandlungs-katalog",
                requires: "verwaltung/behandlungs-katalog",
            },
            /* MVP blind — Rezepte & Atteste vordefinieren (`REZEPTE_ATTESTE_MENU_ENABLED`)
            {
                title: t("page.verwaltung_leistungen.link_vorlagen_title"),
                desc: t("page.verwaltung_leistungen.link_vorlagen_desc"),
                href: "/verwaltung/vorlagen",
                requires: "verwaltung/vorlagen",
            },
            */
            ...(REZEPTE_ATTESTE_MENU_ENABLED
                ? [
                      {
                          title: t("page.verwaltung_leistungen.link_vorlagen_title"),
                          desc: t("page.verwaltung_leistungen.link_vorlagen_desc"),
                          href: "/verwaltung/vorlagen",
                          requires: "verwaltung/vorlagen",
                      },
                  ]
                : []),
        ],
        [t],
    );

    return (
        <VerwaltungTocPage
            title={t("page.verwaltung_leistungen.title")}
            subtitle={t("verwaltung.leistungen.subtitle")}
            links={links}
        />
    );
}
