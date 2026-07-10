/** Session draft when New order → New product → back to New order. */

export const BESTELLUNG_CREATE_DRAFT_KEY = "medoc:bestellung-create-draft";

export type BestellungCreateDraft = {
    lieferantId: string;
    pharmaberaterId: string;
    artikelProduktId: string;
    menge: string;
    einheit: string;
    erwartet_am: string;
    bemerkung: string;
    vorlageInputText: string;
};

export function emptyBestellungCreateDraft(): BestellungCreateDraft {
    return {
        lieferantId: "",
        pharmaberaterId: "",
        artikelProduktId: "",
        menge: "1",
        einheit: "",
        erwartet_am: "",
        bemerkung: "",
        vorlageInputText: "",
    };
}

export function isBestellungCreateReturnPath(path: string | null | undefined): boolean {
    if (!path) return false;
    return path.includes("/bestellungen/neu");
}

export function resolveStammIdByName(list: { id: string; name: string }[], name: string | null | undefined): string {
    const n = name?.trim();
    if (!n) return "";
    const hit = list.find((x) => x.name.trim() === n);
    return hit?.id ?? "";
}

export function saveBestellungCreateDraft(draft: BestellungCreateDraft): void {
    try {
        sessionStorage.setItem(BESTELLUNG_CREATE_DRAFT_KEY, JSON.stringify(draft));
    } catch {
        /* ignore quota / private mode */
    }
}

export function readBestellungCreateDraft(): BestellungCreateDraft | null {
    try {
        const raw = sessionStorage.getItem(BESTELLUNG_CREATE_DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<BestellungCreateDraft>;
        return { ...emptyBestellungCreateDraft(), ...parsed };
    } catch {
        return null;
    }
}

export function clearBestellungCreateDraft(): void {
    try {
        sessionStorage.removeItem(BESTELLUNG_CREATE_DRAFT_KEY);
    } catch {
        /* ignore */
    }
}

export function appendProduktIdToReturnUrl(returnTo: string, produktId: string): string {
    const q = returnTo.indexOf("?");
    const base = q >= 0 ? returnTo.slice(0, q) : returnTo;
    const params = new URLSearchParams(q >= 0 ? returnTo.slice(q + 1) : "");
    params.set("produktId", produktId);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
}
