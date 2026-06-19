import type { BestellStatus } from "./enums.generated";

type TFn = (key: string) => string;

const ZAHLUNGSART_KEYS: Record<string, string> = {
    BAR: "enum.zahlungsart.bar",
    KARTE: "enum.zahlungsart.karte",
    UEBERWEISUNG: "enum.zahlungsart.ueberweisung",
    RECHNUNG: "enum.zahlungsart.rechnung",
};

const ZAHLUNG_STATUS_KEYS: Record<string, { variant: "success" | "warning" | "default"; key: string }> = {
    BEZAHLT: { variant: "success", key: "enum.zahlung_status.bezahlt" },
    TEILBEZAHLT: { variant: "warning", key: "enum.zahlung_status.teilbezahlt" },
    AUSSTEHEND: { variant: "warning", key: "enum.zahlung_status.ausstehend" },
    STORNIERT: { variant: "default", key: "enum.zahlung_status.storniert" },
};

const BESTELL_STATUS_KEYS: Record<BestellStatus, { variant: "success" | "warning" | "default"; key: string }> = {
    OFFEN: { variant: "warning", key: "page.bestellungen.status.offen" },
    UNTERWEGS: { variant: "warning", key: "page.bestellungen.status.unterwegs" },
    GELIEFERT: { variant: "success", key: "page.bestellungen.status.geliefert" },
    STORNIERT: { variant: "default", key: "page.bestellungen.status.storniert" },
};

export function zahlungsartLabel(art: string, t: TFn): string {
    const key = ZAHLUNGSART_KEYS[art];
    return key ? t(key) : art;
}

export function zahlStatusDisplay(
    status: string,
    t: TFn,
): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    const row = ZAHLUNG_STATUS_KEYS[s];
    if (row) return { variant: row.variant, label: t(row.key) };
    return { variant: "default", label: s || "—" };
}

export function bestellStatusDisplay(
    status: string,
    t: TFn,
): { variant: "success" | "warning" | "default"; label: string } {
    const row = BESTELL_STATUS_KEYS[status as BestellStatus];
    if (row) return { variant: row.variant, label: t(row.key) };
    return { variant: "default", label: status };
}

export function bezugKurz(
    z: { behandlung_id?: string | null; untersuchung_id?: string | null },
    t: TFn,
): string {
    if (z.behandlung_id) return t("enum.bezug.behandlung");
    if (z.untersuchung_id) return t("enum.bezug.untersuchung");
    return t("enum.bezug.direktzahlung");
}

export function vorgangText(
    z: { behandlung_id?: string | null; untersuchung_id?: string | null; beschreibung?: string | null },
    t: TFn,
): string {
    const b = bezugKurz(z, t);
    const note = (z.beschreibung ?? "").trim();
    const direct = t("enum.bezug.direktzahlung");
    if (note) return b === direct ? note : `${b} — ${note}`;
    return b;
}

export const BESTELL_STATUS_OPTIONS: readonly BestellStatus[] = ["OFFEN", "UNTERWEGS", "GELIEFERT", "STORNIERT"];

export function bestellStatusOptions(t: TFn): readonly { value: BestellStatus; label: string }[] {
    return BESTELL_STATUS_OPTIONS.map((value) => ({
        value,
        label: bestellStatusDisplay(value, t).label,
    }));
}
