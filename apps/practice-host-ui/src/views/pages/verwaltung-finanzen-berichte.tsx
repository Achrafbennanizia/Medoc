import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { VerwaltungTocPage, type VerwaltungTocLink } from "../components/verwaltung-toc-page";

/** Untermenü „Finanzen & Berichte“ — gleiche Listenseite wie Produkte/Verwaltung-TOC. */
export function VerwaltungFinanzenBerichtePage() {
    const t = useT();
    const links = useMemo<VerwaltungTocLink[]>(
        () => [
            {
                title: t("page.verwaltung_finanzen.link_tagesabschluss_title"),
                desc: t("page.verwaltung_finanzen.link_tagesabschluss_desc"),
                href: "/verwaltung/finanzen-berichte/tagesabschluss",
                requires: "verwaltung/finanzen-berichte/tagesabschluss",
            },
            {
                title: t("page.verwaltung_finanzen.link_rechnung_title"),
                desc: t("page.verwaltung_finanzen.link_rechnung_desc"),
                href: "/verwaltung/finanzen-berichte/rechnung",
                requires: "verwaltung/finanzen-berichte/rechnung",
            },
            {
                title: t("page.verwaltung_finanzen.link_bilanzen_title"),
                desc: t("page.verwaltung_finanzen.link_bilanzen_desc"),
                href: "/bilanz",
                requires: "bilanz",
            },
        ],
        [t],
    );

    return (
        <VerwaltungTocPage
            title={t("page.verwaltung_finanzen.title")}
            subtitle={t("verwaltung.finanzen.subtitle")}
            links={links}
        />
    );
}
