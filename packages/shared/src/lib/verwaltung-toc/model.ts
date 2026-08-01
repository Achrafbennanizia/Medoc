import type { VerwaltungTocHubDef, VerwaltungTocHubId } from "./types";

/** Team hub — simple section/description rows (no icon column), same as Finanzen. */
const TEAM_HUB: VerwaltungTocHubDef = {
    id: "team",
    titleKey: "page.verwaltung_team.title",
    subtitleKey: "verwaltung.team.subtitle",
    items: [
        {
            titleKey: "page.verwaltung_team.link_personal_title",
            descKey: "page.verwaltung_team.link_personal_desc",
            href: "/personal",
            requires: "personal",
        },
        {
            titleKey: "page.verwaltung_team.link_arbeitsplan_title",
            descKey: "page.verwaltung_team.link_arbeitsplan_desc",
            href: "/personal/arbeitsplan",
            requires: "personal/arbeitsplan",
        },
        {
            titleKey: "page.verwaltung_team.link_team_work_time_title",
            descKey: "page.verwaltung_team.link_team_work_time_desc",
            href: "/verwaltung/team/arbeitszeit",
            requires: "verwaltung/team/arbeitszeit",
        },
    ],
};

const FINANZEN_BERICHTE_HUB: VerwaltungTocHubDef = {
    id: "finanzen-berichte",
    titleKey: "page.verwaltung_finanzen.title",
    subtitleKey: "verwaltung.finanzen.subtitle",
    items: [
        {
            titleKey: "page.verwaltung_finanzen.link_tagesabschluss_title",
            descKey: "page.verwaltung_finanzen.link_tagesabschluss_desc",
            href: "/verwaltung/finanzen-berichte/tagesabschluss",
            requires: "verwaltung/finanzen-berichte/tagesabschluss",
        },
        {
            titleKey: "page.verwaltung_finanzen.link_rechnung_title",
            descKey: "page.verwaltung_finanzen.link_rechnung_desc",
            href: "/verwaltung/finanzen-berichte/rechnung",
            requires: "verwaltung/finanzen-berichte/rechnung",
        },
        {
            titleKey: "page.verwaltung_finanzen.link_bilanzen_title",
            descKey: "page.verwaltung_finanzen.link_bilanzen_desc",
            href: "/bilanz",
            requires: "bilanz",
        },
    ],
};

const LAGER_HUB: VerwaltungTocHubDef = {
    id: "lager",
    titleKey: "page.verwaltung_lager.title",
    subtitleKey: "verwaltung.lager.subtitle",
    items: [
        {
            titleKey: "page.verwaltung_lager.link_produkte_title",
            descKey: "page.verwaltung_lager.link_produkte_desc",
            href: "/produkte",
            requires: "produkte",
            featureFlag: "produkteMenu",
        },
        {
            titleKey: "page.verwaltung_lager.link_bestellstamm_title",
            descKey: "page.verwaltung_lager.link_bestellstamm_desc",
            href: "/verwaltung/bestellstamm",
            requires: "verwaltung/bestellstamm",
        },
        {
            titleKey: "page.verwaltung_lager.link_vertraege_title",
            descKey: "page.verwaltung_lager.link_vertraege_desc",
            href: "/verwaltung/vertraege",
            requires: "verwaltung/vertraege",
        },
    ],
};

const LEISTUNGEN_HUB: VerwaltungTocHubDef = {
    id: "leistungen",
    titleKey: "page.verwaltung_leistungen.title",
    subtitleKey: "verwaltung.leistungen.subtitle",
    items: [
        {
            titleKey: "page.verwaltung_leistungen.link_leistungen_title",
            descKey: "page.verwaltung_leistungen.link_leistungen_desc",
            href: "/leistungen",
            requires: "leistungen",
            featureFlag: "leistungenMenu",
        },
        {
            titleKey: "page.verwaltung_leistungen.link_behandlung_title",
            descKey: "page.verwaltung_leistungen.link_behandlung_desc",
            href: "/verwaltung/behandlungs-katalog",
            requires: "verwaltung/behandlungs-katalog",
        },
        {
            titleKey: "page.verwaltung_leistungen.link_vorlagen_title",
            descKey: "page.verwaltung_leistungen.link_vorlagen_desc",
            href: "/verwaltung/vorlagen",
            requires: "verwaltung/vorlagen",
            featureFlag: "rezepteAttesteMenu",
        },
    ],
};

const PRAXISPLANUNG_HUB: VerwaltungTocHubDef = {
    id: "praxisplanung",
    titleKey: "page.praxisplanung.title",
    subtitleKey: "page.praxisplanung.subtitle",
    items: [
        {
            titleKey: "page.praxisplanung.link_arbeitstage_title",
            descKey: "page.praxisplanung.link_arbeitstage_desc",
            href: "/verwaltung/arbeitstage",
            requires: "verwaltung/arbeitstage",
        },
        {
            titleKey: "page.praxisplanung.link_sperrzeiten_title",
            descKey: "page.praxisplanung.link_sperrzeiten_desc",
            href: "/verwaltung/sonder-sperrzeiten",
            requires: "verwaltung/sonder-sperrzeiten",
        },
        {
            titleKey: "page.praxisplanung.link_arbeitszeiten_title",
            descKey: "page.praxisplanung.link_arbeitszeiten_desc",
            href: "/verwaltung/arbeitszeiten",
            requires: "verwaltung/arbeitszeiten",
        },
        {
            titleKey: "page.praxisplanung.link_praeferenzen_title",
            descKey: "page.praxisplanung.link_praeferenzen_desc",
            href: "/verwaltung/praxis-praeferenzen",
            requires: "verwaltung/praxis-praeferenzen",
        },
    ],
};

/** Top-level Verwaltung menu — icon column for hub categories. */
const ROOT_HUB: VerwaltungTocHubDef = {
    id: "root",
    titleKey: "page.verwaltung.title",
    subtitleKey: "page.verwaltung.subtitle",
    items: [
        {
            titleKey: "page.verwaltung.link_team_title",
            descKey: "page.verwaltung.link_team_desc",
            href: "/verwaltung/team",
            iconKey: "/personal",
            requires: "verwaltung/team",
        },
        {
            titleKey: "page.verwaltung.link_finanzen_title",
            descKey: "page.verwaltung.link_finanzen_desc",
            href: "/verwaltung/finanzen-berichte",
            iconKey: "/finanzen",
            requires: "verwaltung/finanzen-berichte",
        },
        {
            titleKey: "page.verwaltung.link_lager_title",
            descKey: "page.verwaltung.link_lager_desc",
            href: "/verwaltung/lager-und-bestellwesen",
            iconKey: "/produkte",
            requires: "verwaltung/lager-und-bestellwesen",
        },
        {
            titleKey: "page.verwaltung.link_leistungen_title",
            descKey: "page.verwaltung.link_leistungen_desc",
            href: "/verwaltung/leistungen-kataloge-vorlagen",
            iconKey: "/leistungen",
            requires: "verwaltung/leistungen-kataloge-vorlagen",
        },
        {
            titleKey: "page.verwaltung.link_praxis_title",
            descKey: "page.verwaltung.link_praxis_desc",
            href: "/verwaltung/praxisplanung",
            iconKey: "/termine",
            requires: "verwaltung/praxisplanung",
        },
    ],
};

export const VERWALTUNG_TOC_HUBS: Record<VerwaltungTocHubId, VerwaltungTocHubDef> = {
    root: ROOT_HUB,
    team: TEAM_HUB,
    "finanzen-berichte": FINANZEN_BERICHTE_HUB,
    lager: LAGER_HUB,
    leistungen: LEISTUNGEN_HUB,
    praxisplanung: PRAXISPLANUNG_HUB,
};

export function getVerwaltungTocHubDef(hubId: VerwaltungTocHubId): VerwaltungTocHubDef {
    return VERWALTUNG_TOC_HUBS[hubId];
}
