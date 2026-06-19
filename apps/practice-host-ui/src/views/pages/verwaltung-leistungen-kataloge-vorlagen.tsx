import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

/** Leistungen, Kataloge, Vorlagen — Tabelle in Karte. */
export function VerwaltungLeistungenKatalogeVorlagenPage() {
    const t = useT();
    const links = useMemo<VerwaltungTocLink[]>(
        () => [
            {
                title: t("page.verwaltung_leistungen.link_leistungen_title"),
                desc: t("page.verwaltung_leistungen.link_leistungen_desc"),
                href: "/leistungen",
                requires: "leistungen",
            },
            {
                title: t("page.verwaltung_leistungen.link_behandlung_title"),
                desc: t("page.verwaltung_leistungen.link_behandlung_desc"),
                href: "/verwaltung/behandlungs-katalog",
                requires: "verwaltung/behandlungs-katalog",
            },
            {
                title: t("page.verwaltung_leistungen.link_vorlagen_title"),
                desc: t("page.verwaltung_leistungen.link_vorlagen_desc"),
                href: "/verwaltung/vorlagen",
                requires: "verwaltung/vorlagen",
            },
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
