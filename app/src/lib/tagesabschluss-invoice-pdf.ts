import { getAkte, listBehandlungen, listUntersuchungen } from "@/controllers/akte.controller";
import { renderInvoicePdf } from "@/controllers/invoice.controller";
import type { TagesabschlussProtokoll } from "@/controllers/tagesabschluss-protokoll.controller";
import { zahlungLocalYmd } from "@/lib/tagesabschluss";
import {
    buildTagesberichtLines,
    getInvoicePraxisFromStorage,
    nextBerichtNummer,
} from "@/lib/invoice-leistung";
import type { Patient, Zahlung } from "@/models/types";

type PatientName = Pick<Patient, "id" | "name" | "adresse">;

/**
 * Tagesbericht (PDF) für den Stichtag — alle Patienten mit B/U-Zuordnung an diesem Tag, gleicher Druck-Backend (FA-FIN-INVOICE), kein einzelner Patienten-Empfänger.
 */
export async function downloadTagesabschlussBerichtPdf(
    row: TagesabschlussProtokoll,
    zahlungen: Zahlung[],
    patienten: PatientName[],
): Promise<void> {
    const stichtag = row.stichtag;
    const onDay = zahlungen.filter(
        (z) => zahlungLocalYmd(z.created_at) === stichtag && z.status !== "STORNIERT",
    );
    const pids = [
        ...new Set(
            onDay.filter((z) => (z.behandlung_id ?? z.untersuchung_id) != null).map((z) => z.patient_id),
        ),
    ];
    if (pids.length === 0) {
        pids.push(...new Set(onDay.map((z) => z.patient_id)));
    }

    const aggregated: { description: string; amount_cents: number }[] = [];
    for (const pid of pids) {
        const name = patienten.find((x) => x.id === pid)?.name?.trim() || pid;
        let beh: Awaited<ReturnType<typeof listBehandlungen>> = [];
        let unters: Awaited<ReturnType<typeof listUntersuchungen>> = [];
        try {
            const akte = await getAkte(pid);
            [beh, unters] = await Promise.all([listBehandlungen(akte.id), listUntersuchungen(akte.id)]);
        } catch {
            // Akte fehlt — Zeilen trotzdem leer oder nur generisch
        }
        const part = buildTagesberichtLines(stichtag, pid, zahlungen, beh, unters);
        for (const l of part) {
            const isLeerHinweis = l.description.includes("keine zugeordneten B-/U");
            if (isLeerHinweis && pids.length > 1) {
                continue;
            }
            const description =
                pids.length === 1 && isLeerHinweis
                    ? l.description
                    : `Patient: ${name}\n\n${l.description}`;
            aggregated.push({ description, amount_cents: l.amount_cents });
        }
    }

    if (aggregated.length === 0) {
        aggregated.push({
            description: `Tagesbericht ${stichtag} — am Stichtag keine nutzbaren B-/U-Daten (Patienten: ${pids.length}).`,
            amount_cents: 1,
        });
    }

    const praxis = getInvoicePraxisFromStorage();
    const num = nextBerichtNummer(stichtag);
    const note = [
        `Gesamttagesbericht zu Tagesabschluss ${stichtag} · nicht an eine Einzelperson adressiert`,
        `Bargeld laut System: ${row.bar_laut_system_eur} €`,
        row.gezaehlt_eur != null ? `Gezählt: ${row.gezaehlt_eur} €` : null,
        row.notiz?.trim() ? `Hinweis: ${row.notiz.trim()}` : null,
    ]
        .filter(Boolean)
        .join(" · ");

    const bytes = await renderInvoicePdf({
        number: num,
        date: stichtag,
        recipient_name: "Tagesbericht (Gesamtdokumentation)",
        recipient_address: [stichtag, "Beleg-Überblick je Patient mit Tagesvorgang"],
        practice_name: praxis.name,
        practice_address: praxis.addr.split("\n").map((s) => s.trim()).filter(Boolean),
        lines: aggregated,
        note: note || null,
    });
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tagesbericht-${stichtag.replace(/[^\d-]/g, "")}-gesamt.pdf`;
    a.click();
    URL.revokeObjectURL(url);
}
