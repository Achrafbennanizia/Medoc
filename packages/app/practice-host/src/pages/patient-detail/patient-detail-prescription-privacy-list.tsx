/** Prescription / certificate chart tables with Group record privacy (T5.2). */
import { useT } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { prescriptionStatusDisplay } from "@/lib/patient-detail-utils";
import type { Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import type { Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import { RecordPrivacy } from "@/views/components/record-privacy";
import { Badge } from "@/views/components/ui/badge";
import { PaymentRowActionsMenu, type PaymentRowAction } from "@/views/components/payment-row-actions-menu";
import { Fragment } from "react";

export function PrescriptionPrivacyTable({
    prescriptions,
    canWriteMedical,
    onExport,
    onDelete,
}: {
    prescriptions: Prescription[];
    canWriteMedical: boolean;
    onExport: (r: Prescription) => void;
    onDelete: (id: string) => void;
}) {
    const t = useT();
    return (
        <div className="prescription-certificate-table-scroll">
            <table className="tbl tbl-prescription-chart">
                <colgroup>
                    <col className="prescription-col-med" />
                    <col className="prescription-col-dosage" />
                    <col className="prescription-col-duration" />
                    <col className="prescription-col-status" />
                    <col className="prescription-col-issued" />
                    <col className="prescription-col-actions" />
                </colgroup>
                <thead>
                    <tr>
                        <th>{t("page.prescriptions.col.medication")}</th>
                        <th>{t("page.prescriptions.col.dosage")}</th>
                        <th>{t("page.prescriptions.col.duration")}</th>
                        <th>{t("page.prescriptions.col.status")}</th>
                        <th>{t("common.issued")}</th>
                        <th className="prescription-th-actions">{t("patient.detail.tab.treatment.col.action")}</th>
                    </tr>
                </thead>
                <tbody>
                    {prescriptions.map((r) => {
                        const st = prescriptionStatusDisplay(r.status, t);
                        const actions: PaymentRowAction[] = [
                            { id: "export", label: t("common.export"), onClick: () => onExport(r) },
                        ];
                        if (canWriteMedical) {
                            actions.push({
                                id: "delete",
                                label: t("common.delete"),
                                onClick: () => onDelete(r.id),
                                danger: true,
                            });
                        }
                        return (
                            <Fragment key={r.id}>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>{r.medication}</td>
                                    <td>{r.dosage}</td>
                                    <td>{r.duration}</td>
                                    <td>
                                        <Badge variant={st.variant}>{st.label}</Badge>
                                    </td>
                                    <td>{formatDate(r.issued_at)}</td>
                                    <td className="prescription-td-actions">
                                        <PaymentRowActionsMenu ariaLabel={t("common.actions")} actions={actions} />
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={6}>
                                        <RecordPrivacy
                                            entityTable="prescription"
                                            entityId={r.id}
                                            ownerId={r.signed_by_staff_id ?? r.physician_id}
                                        />
                                    </td>
                                </tr>
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function CertificatePrivacyTable({
    certificates,
    canWriteMedical,
    onExport,
    onDelete,
}: {
    certificates: Certificate[];
    canWriteMedical: boolean;
    onExport: (r: Certificate) => void;
    onDelete: (id: string) => void;
}) {
    const t = useT();
    return (
        <div className="prescription-certificate-table-scroll">
            <table className="tbl tbl-certificate-chart">
                <colgroup>
                    <col className="certificate-col-type" />
                    <col className="certificate-col-from" />
                    <col className="certificate-col-until" />
                    <col className="certificate-col-issued" />
                    <col className="certificate-col-actions" />
                </colgroup>
                <thead>
                    <tr>
                        <th>{t("page.patient_detail.certificate.col.type")}</th>
                        <th>{t("common.valid_from")}</th>
                        <th>{t("common.valid_until")}</th>
                        <th>{t("common.issued")}</th>
                        <th className="certificate-th-actions">{t("patient.detail.tab.treatment.col.action")}</th>
                    </tr>
                </thead>
                <tbody>
                    {certificates.map((r) => {
                        const actions: PaymentRowAction[] = [
                            { id: "export", label: t("common.export"), onClick: () => onExport(r) },
                        ];
                        if (canWriteMedical) {
                            actions.push({
                                id: "delete",
                                label: t("common.delete"),
                                onClick: () => onDelete(r.id),
                                danger: true,
                            });
                        }
                        return (
                            <Fragment key={r.id}>
                                <tr>
                                    <td style={{ fontWeight: 600 }}>{r.kind}</td>
                                    <td>{formatDate(r.valid_from)}</td>
                                    <td>{formatDate(r.valid_until)}</td>
                                    <td>{formatDate(r.issued_at)}</td>
                                    <td className="certificate-td-actions">
                                        <PaymentRowActionsMenu ariaLabel={t("common.actions")} actions={actions} />
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={5}>
                                        <RecordPrivacy
                                            entityTable="certificate"
                                            entityId={r.id}
                                            ownerId={r.signed_by_staff_id ?? r.physician_id}
                                        />
                                    </td>
                                </tr>
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
