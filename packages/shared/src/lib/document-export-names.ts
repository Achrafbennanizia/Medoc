/** Suggested file names for exported clinical documents. */
import type { Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import type { Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import type { Payment } from "@/models/types";

export function suggestCertificateExportBasename(a: Certificate): string {
    const day = a.issued_at.slice(0, 10);
    return `Certificate_${day}_${a.id.slice(0, 8)}`;
}

export function suggestPrescriptionExportBasename(r: Prescription): string {
    const day = r.issued_at.slice(0, 10);
    const slug = r.medication.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 28).trim() || "Prescription";
    return `Prescription_${day}_${slug}`;
}

export function suggestPrescriptionComboExportBasename(items: Prescription[]): string {
    if (items.length === 0) return "Prescription";
    const first = items[0]!;
    const day = first.issued_at.slice(0, 10);
    if (items.length === 1) return suggestPrescriptionExportBasename(first);
    return `prescription_combo_${day}_${items.length}x`;
}

export function suggestReceiptExportBasename(z: Payment): string {
    const day = z.created_at.slice(0, 10);
    return `Receipt_${day}_${z.id.slice(0, 8)}`;
}
