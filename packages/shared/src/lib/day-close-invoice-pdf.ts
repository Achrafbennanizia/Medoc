import { getChart, listTreatments, listExaminations } from "@/systems/practice-host/controllers/chart.controller";
import { allocateReportNumber, renderInvoicePdf } from "@/systems/practice-host/controllers/invoice.controller";
import type { DayCloseProtocol } from "@/systems/practice-host/controllers/day-close-protocol.controller";
import { paymentLocalYmd } from "@/lib/day-close";
import {
    buildDailyReportLines,
    buildInvoiceHeaderAddressLinesForExport,
    getInvoicePracticeFromStorage,
} from "@/lib/invoice-service-item";
import { checkPracticeDocumentReadiness, practiceMissingFieldLabel } from "@/lib/practice-completeness";
import { translateLocale } from "@/lib/i18n";
import { openExportPreview } from "@/models/store/export-preview-store";
import type { Patient, Payment } from "@/models/types";

type PatientName = Pick<Patient, "id" | "name" | "address">;

/**
 * Daily report (PDF) for the date — all Patients with B/U assignment that day, same print backend (FA-FIN-INVOICE), no single patient recipient.
 */
export async function downloadDayCloseReportPdf(
    row: DayCloseProtocol,
    payments: Payment[],
    patients: PatientName[],
): Promise<void> {
    const as_of_date = row.as_of_date;
    const onDay = payments.filter(
        (z) => paymentLocalYmd(z.created_at) === as_of_date && z.status !== "CANCELLED",
    );
    const pids = [
        ...new Set(
            onDay.filter((z) => (z.treatment_id ?? z.examination_id) != null).map((z) => z.patient_id),
        ),
    ];
    if (pids.length === 0) {
        pids.push(...new Set(onDay.map((z) => z.patient_id)));
    }

    const aggregated: { description: string; amount_cents: number }[] = [];
    for (const pid of pids) {
        const name = patients.find((x) => x.id === pid)?.name?.trim() || pid;
        let beh: Awaited<ReturnType<typeof listTreatments>> = [];
        let unters: Awaited<ReturnType<typeof listExaminations>> = [];
        try {
            const chart = await getChart(pid);
            [beh, unters] = await Promise.all([listTreatments(chart.id), listExaminations(chart.id)]);
        } catch {
            // Chart missing — lines still empty or generic only
        }
        const part = buildDailyReportLines(as_of_date, pid, payments, beh, unters);
        for (const l of part) {
            const isLeerHinweis = l.description.includes("no linked treatment/examination payments");
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
            description: `Daily report ${as_of_date} — no usable treatment/examination data on the report date (patients: ${pids.length}).`,
            amount_cents: 1,
        });
    }

    const practice = getInvoicePracticeFromStorage();
    const readiness = checkPracticeDocumentReadiness(practice, "daily_report");
    if (!readiness.ready) {
        const labels = readiness.missingFields
            .map((m) => practiceMissingFieldLabel((k) => translateLocale("en", k), m))
            .join(", ");
        throw new Error(
            `Practice master data incomplete (${labels}). Please fill in Settings › Practice.`,
        );
    }
    const num = await allocateReportNumber(as_of_date);
    const bankLines: string[] = [];
    const iban = (practice.bank_iban ?? "").trim();
    if (iban) {
        const bic = (practice.bank_bic ?? "").trim();
        const bankName = (practice.bank_name ?? "").trim();
        bankLines.push(
            `Bank details: IBAN ${iban}${bic ? ` BIC ${bic}` : ""}${bankName ? ` (${bankName})` : ""}`,
        );
    }
    const note = [
        `Combined daily report for day-end closing ${as_of_date} · not addressed to an individual`,
        `Cash per system: ${row.system_cash_eur} €`,
        row.counted_eur != null ? `Counted: ${row.counted_eur} €` : null,
        row.note?.trim() ? `Note: ${row.note.trim()}` : null,
    ]
        .filter(Boolean)
        .join(" · ");

    const bytes = await renderInvoicePdf({
        number: num,
        date: as_of_date,
        recipient_name: "Daily report (combined documentation)",
        recipient_address: [as_of_date, "Receipt overview per patient with day activity"],
        practice_name: practice.name,
        practice_address: buildInvoiceHeaderAddressLinesForExport(practice),
        lines: aggregated,
        note: note || null,
        clinician_name: practice.clinician_name?.trim() || null,
        clinician_zanr: practice.zanr?.trim() || null,
        practice_bsnr: practice.bsnr?.trim() || null,
        bank_details: bankLines.length > 0 ? bankLines : null,
        payment_terms_text: null,
        vat_notice: practice.vat_exemption_notice?.trim() || null,
    });
    openExportPreview({
        format: "pdf",
        title: "Daily report (PDF)",
        hint: `Report date ${as_of_date} · Combined documentation · Print or save.`,
        suggestedFilename: `daily_report-${as_of_date.replace(/[^\d-]/g, "")}-gesamt.pdf`,
        binaryBody: new Uint8Array(bytes),
    });
}
