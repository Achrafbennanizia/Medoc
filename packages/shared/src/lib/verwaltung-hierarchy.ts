/** One level up within Verwaltung (and top-level Wirtschaft pages opened from a hub). */

export type VerwaltungBackTarget = { path: string; labelKey: string };

const VERWALTUNG: VerwaltungBackTarget = { path: "/verwaltung", labelKey: "nav.verwaltung" };

const FINANZEN_BERICHTE: VerwaltungBackTarget = {
    path: "/verwaltung/finanzen-berichte",
    labelKey: "verwaltung.back.finanzen_berichte",
};

const LAGER_HUB: VerwaltungBackTarget = {
    path: "/verwaltung/lager-und-bestellwesen",
    labelKey: "verwaltung.back.lager",
};

const LEISTUNGEN_HUB: VerwaltungBackTarget = {
    path: "/verwaltung/leistungen-kataloge-vorlagen",
    labelKey: "verwaltung.back.leistungen",
};

const PRAXIS_HUB: VerwaltungBackTarget = {
    path: "/verwaltung/praxisplanung",
    labelKey: "verwaltung.back.praxisplanung",
};

const TEAM_HUB: VerwaltungBackTarget = {
    path: "/verwaltung/team",
    labelKey: "verwaltung.back.team",
};

const VORLAGEN_LIST: VerwaltungBackTarget = { path: "/verwaltung/vorlagen", labelKey: "verwaltung.back.vorlagen" };

/**
 * Resolves the parent screen for the back button: hub → Verwaltung, sub-page → hub, not always `/verwaltung`.
 */
export function getVerwaltungBackTarget(pathnameWithOptionalQuery: string): VerwaltungBackTarget {
    const raw = (pathnameWithOptionalQuery.split("?")[0] ?? "/").replace(/\/$/, "") || "/";

    if (raw === "/verwaltung") {
        return { path: "/", labelKey: "nav.dashboard" };
    }

    if (raw.startsWith("/verwaltung/vorlagen/editor")) {
        return VORLAGEN_LIST;
    }

    if (raw.startsWith("/verwaltung/finanzen-berichte/") && raw !== "/verwaltung/finanzen-berichte") {
        return FINANZEN_BERICHTE;
    }

    const exact: Record<string, VerwaltungBackTarget> = {
        "/verwaltung/finanzen-werkzeuge": FINANZEN_BERICHTE,
        "/verwaltung/tagesabschluss": FINANZEN_BERICHTE,
        "/verwaltung/finanzen-berichte": VERWALTUNG,
        "/verwaltung/lager-und-bestellwesen": VERWALTUNG,
        "/verwaltung/leistungen-kataloge-vorlagen": VERWALTUNG,
        "/verwaltung/praxisplanung": VERWALTUNG,
        "/verwaltung/vertraege": LAGER_HUB,
        "/verwaltung/bestellstamm": LAGER_HUB,
        "/verwaltung/behandlungs-katalog": LEISTUNGEN_HUB,
        "/verwaltung/vorlagen": LEISTUNGEN_HUB,
        "/verwaltung/arbeitstage": PRAXIS_HUB,
        "/verwaltung/sonder-sperrzeiten": PRAXIS_HUB,
        "/verwaltung/arbeitszeiten": PRAXIS_HUB,
        "/verwaltung/praxis-praeferenzen": PRAXIS_HUB,
        "/leistungen": LEISTUNGEN_HUB,
        "/produkte": LAGER_HUB,
        "/personal": TEAM_HUB,
        "/verwaltung/team/arbeitszeit": TEAM_HUB,
        "/bilanz": FINANZEN_BERICHTE,
        "/bilanz/neu": FINANZEN_BERICHTE,
    };

    if (exact[raw]) {
        return exact[raw]!;
    }

    if (raw.startsWith("/personal/") && raw !== "/personal") {
        return TEAM_HUB;
    }

    if (raw.startsWith("/leistungen/")) {
        return LEISTUNGEN_HUB;
    }

    return VERWALTUNG;
}
