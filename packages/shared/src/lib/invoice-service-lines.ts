/** Invoice lines from chart entries: GOZ fees, service options, daily report lines (split from `invoice-service-item.ts`). */
import type { Treatment, Examination, Payment } from "@/models/types";
import type { InvoiceLineInput } from "@/systems/practice-host/controllers/invoice.controller";
import { formatCurrency } from "@/lib/utils";
import { examinationLineLabel, treatmentLineLabel } from "@/lib/clinical-service-label";
import { buildPaymentLinkSelectOptions, paymentCountsTowardPaid, roundMoney2 } from "@/lib/payment-booking";
import { paymentLocalYmd } from "@/lib/day-close";
import { moneyToInvoiceCents } from "./invoice-service-item";

function parseServiceItemLink(
    version: string,
):
    | { kind: "treatment"; id: string }
    | { kind: "examination"; id: string }
    | null {
    if (version.startsWith("treatment:")) return { kind: "treatment", id: version.slice("treatment:".length) };
    if (version.startsWith("examination:")) return { kind: "examination", id: version.slice("examination:".length) };
    return null;
}

/** GOZ 5,62421 Cent / GOÄ 5,82873 Cent per point — must match `pdf/goz.rs`. */
const PUNKTWERT_E5: Record<"goz" | "goae", number> = { goz: 562_421, goae: 582_873 };

/** Fee for one unit in cents: points × Punktwert × factor (half-up), as on the server. */
export function gozUnitFeeCents(schedule: "goz" | "goae", points: number, factor: number): number {
    const factorX100 = Math.round(factor * 100);
    const raw = points * PUNKTWERT_E5[schedule] * factorX100;
    const denom = 100_000 * 100;
    return Math.floor((raw + denom / 2) / denom);
}

type ServiceLabels = { treatment: string; examination: string };

const ENGLISH_SERVICE_LABELS: ServiceLabels = { treatment: "Treatment", examination: "Examination" };

/** Recorded fee, or the sum already paid on that chart line when the fee was left empty. */
function billableCents(
    recorded: number | null | undefined,
    payments: Payment[],
    patientId: string,
    kind: "treatment" | "examination",
    id: string,
): number | null {
    if (recorded != null && Number.isFinite(recorded)) {
        const cost = roundMoney2(recorded);
        if (cost > 0) return moneyToInvoiceCents(cost);
    }
    const paid = roundMoney2(
        payments
            .filter(
                (z) =>
                    z.patient_id === patientId
                    && paymentCountsTowardPaid(z.status)
                    && (kind === "treatment" ? z.treatment_id === id : z.examination_id === id),
            )
            .reduce((sum, z) => sum + z.amount, 0),
    );
    if (paid > 0) return moneyToInvoiceCents(paid);
    return null;
}

/**
 * Invoice line for a treatment / examination. Treatments with GOZ billing data
 * become fee lines (number, points, factor, date, tooth); everything else is
 * an `other` line at its recorded cost, or at the amount already paid when the
 * chart has no fee. Returns `null` when neither is a positive amount — the old
 * 0,01 € placeholder produced invoices with fake amounts.
 */
export function lineFromServiceItemChoice(
    link: string,
    patientId: string,
    treatments: Treatment[],
    examinations: Examination[],
    payments: Payment[],
    labels: ServiceLabels = ENGLISH_SERVICE_LABELS,
): InvoiceLineInput | null {
    const p = parseServiceItemLink(link);
    if (!p) return null;
    if (p.kind === "treatment") {
        const b = treatments.find((x) => x.id === p.id);
        if (!b) return null;
        const serviceLabel = treatmentLineLabel(b, labels.treatment);
        const date = (b.treatment_date ?? b.created_at ?? "").slice(0, 10) || null;
        const schedule = b.fee_schedule ?? null;
        if ((schedule === "goz" || schedule === "goae") && b.goz_nr && b.points != null && b.factor != null) {
            const qty = Math.max(1, b.quantity ?? 1);
            return {
                description: serviceLabel,
                fee_schedule: schedule,
                goz_nr: b.goz_nr,
                points: b.points,
                factor: b.factor,
                quantity: qty,
                amount_cents: gozUnitFeeCents(schedule, b.points, b.factor) * qty,
                tooth_nr: (b.teeth ?? "").trim() || null,
                treatment_date: date,
                diagnosis_reason: b.factor_reason ?? null,
                analog_of: b.analog_of ?? null,
                agreement_ref: b.agreement_ref ?? null,
                material: (b.material ?? "").trim() || null,
                source_ref: `treatment:${b.id}`,
            };
        }
        const cents = billableCents(b.total_cost, payments, patientId, "treatment", b.id);
        if (cents == null) return null;
        return {
            description: serviceLabel,
            fee_schedule: schedule === "material" || schedule === "lab" ? schedule : "other",
            amount_cents: cents,
            tooth_nr: (b.teeth ?? "").trim() || null,
            treatment_date: date,
            source_ref: `treatment:${b.id}`,
        };
    }
    const u = examinations.find((x) => x.id === p.id);
    if (!u) return null;
    const cents = billableCents(u.total_cost, payments, patientId, "examination", u.id);
    if (cents == null) return null;
    const serviceLabel = examinationLineLabel(u, labels.examination).slice(0, 200);
    return {
        description: serviceLabel,
        fee_schedule: "other",
        amount_cents: cents,
        treatment_date: (u.created_at ?? "").slice(0, 10) || null,
        source_ref: `examination:${u.id}`,
    };
}

/** Chart lines that can be invoiced, including ones already paid. */
export function buildInvoiceServiceOptions(
    payments: Payment[],
    patientId: string,
    treatments: Treatment[],
    examinations: Examination[],
    t: (key: string) => string,
    tp: (key: string, params: Record<string, string | number>) => string,
): { value: string; label: string }[] {
    const labels: ServiceLabels = {
        treatment: t("payment.link.treatment"),
        examination: t("payment.link.examination"),
    };
    const billable = buildPaymentLinkSelectOptions(treatments, examinations, t, tp).filter(
        (option) =>
            !option.value
            || lineFromServiceItemChoice(option.value, patientId, treatments, examinations, payments, labels) != null,
    );
    if (billable.length <= 1) {
        return [{ value: "", label: t("page.administration_finance_tools.no_billable") }];
    }
    return billable;
}

/**
 * One Patient / one date: grouped payment lines for daily report PDF.
 * (The full PDF in `day_close-invoice-pdf.ts` calls this per Patient and merges blocks.)
 */
export function buildDailyReportLines(
    as_of_date: string,
    patientId: string,
    payments: Payment[],
    treatments: Treatment[],
    examinations: Examination[],
): { description: string; amount_cents: number }[] {
    const onDay = payments.filter(
        (z) => z.patient_id === patientId && paymentLocalYmd(z.created_at) === as_of_date && paymentCountsTowardPaid(z.status),
    );
    const paidOnDay = (id: "treatment" | "examination", uId: string) =>
        roundMoney2(
            onDay
                .filter((z) => (id === "treatment" ? z.treatment_id === uId : z.examination_id === uId))
                .reduce((s, z) => s + z.amount, 0),
        );
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const z of onDay) {
        if (z.treatment_id) {
            const k = `b:${z.treatment_id}`;
            if (!seen.has(k)) {
                seen.add(k);
                keys.push(`treatment:${z.treatment_id}`);
            }
        } else if (z.examination_id) {
            const k = `u:${z.examination_id}`;
            if (!seen.has(k)) {
                seen.add(k);
                keys.push(`examination:${z.examination_id}`);
            }
        }
    }
    const out: { description: string; amount_cents: number }[] = [];
    for (const k of keys) {
        const row = lineFromServiceItemChoice(k, patientId, treatments, examinations, payments);
        if (row) {
            const p = parseServiceItemLink(k);
            const tagDosing = p
                ? p.kind === "treatment"
                    ? paidOnDay("treatment", p.id)
                    : paidOnDay("examination", p.id)
                : 0;
            const withDay = `${row.description}\nPosted on report date ${as_of_date}: ${formatCurrency(tagDosing)}`;
            out.push({ description: withDay, amount_cents: row.amount_cents });
        }
    }
    // No placeholder line: an empty day is reported as empty, never as 0,01 €.
    return out;
}
