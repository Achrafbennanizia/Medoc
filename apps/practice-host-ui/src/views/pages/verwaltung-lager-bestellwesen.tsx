import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

/** Lager, Produkte, Bestellstamm und Verträge — Tabelle in Karte (Produkte-Muster). */
export function VerwaltungLagerBestellwesenPage() {
    const t = useT();
    const links = useMemo<VerwaltungTocLink[]>(
        () => [
            {
                title: t("page.verwaltung_lager.link_produkte_title"),
                desc: t("page.verwaltung_lager.link_produkte_desc"),
                href: "/produkte",
                requires: "produkte",
            },
            {
                title: t("page.verwaltung_lager.link_bestellstamm_title"),
                desc: t("page.verwaltung_lager.link_bestellstamm_desc"),
                href: "/verwaltung/bestellstamm",
                requires: "verwaltung/bestellstamm",
            },
            {
                title: t("page.verwaltung_lager.link_vertraege_title"),
                desc: t("page.verwaltung_lager.link_vertraege_desc"),
                href: "/verwaltung/vertraege",
                requires: "verwaltung/vertraege",
            },
        ],
        [t],
    );

    return (
        <VerwaltungTocPage
            title={t("page.verwaltung_lager.title")}
            subtitle={t("verwaltung.lager.subtitle")}
            links={links}
        />
    );
}
