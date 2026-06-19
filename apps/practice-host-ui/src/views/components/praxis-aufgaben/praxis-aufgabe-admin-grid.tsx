import { useT, useTParams } from "@/lib/i18n";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { Patient, Personal } from "@/models/types";
import type { PraxisAufgabe } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { formatDateTime } from "@/lib/utils";
import { EditIcon } from "@/lib/icons";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { aufgabePatientLabel } from "./constants";
import { assigneeLabel, aufgabeStatusVariant, userCanViewAufgabe } from "./aufgabe-workflow";
import { aufgabeStatusLabel } from "./aufgabe-workflow-ui";

type Props = {
    rows: PraxisAufgabe[];
    patientMap: Map<string, Patient>;
    personal: Personal[];
    userId: string;
    isRezeption: boolean;
    canAdmin?: boolean;
    /** Fewer columns for the embedded Praxis-Aufgaben tab (fits workspace width). */
    compact?: boolean;
    onOpen: (row: PraxisAufgabe) => void;
    onEdit: (row: PraxisAufgabe) => void;
};

export function PraxisAufgabeAdminGrid({
    rows,
    patientMap,
    personal,
    userId,
    isRezeption,
    canAdmin = false,
    compact = false,
    onOpen,
    onEdit,
}: Props) {
    const t = useT();
    const tp = useTParams();
    return (
        <div className="card aufgaben-table-card tbl-data-card card--overflow-visible">
            <div className="tbl-scroll">
                <table className={`tbl tbl-aufgaben${compact ? " tbl-aufgaben--compact" : ""}`}>
                    <colgroup>
                        <col className="aufgaben-col-updated" />
                        <col className="aufgaben-col-titel" />
                        {!compact ? (
                            <>
                                <col className="aufgaben-col-patient" />
                                <col className="aufgaben-col-typ" />
                                <col className="aufgaben-col-assignee" />
                            </>
                        ) : null}
                        <col className="aufgaben-col-status" />
                        <col className="aufgaben-col-action" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th scope="col" className="aufgaben-th-updated">
                                {t("praxis.aufgaben.admin.col_updated")}
                            </th>
                            <th scope="col" className="aufgaben-th-titel">
                                {t("praxis.aufgaben.admin.col_title")}
                            </th>
                            {!compact ? (
                                <>
                                    <th scope="col" className="aufgaben-th-patient">
                                        {t("praxis.aufgaben.admin.col_patient")}
                                    </th>
                                    <th scope="col" className="aufgaben-th-typ">
                                        {t("praxis.aufgaben.admin.col_type")}
                                    </th>
                                    <th scope="col" className="aufgaben-th-assignee">
                                        {t("praxis.aufgaben.admin.col_assignee")}
                                    </th>
                                </>
                            ) : null}
                            <th scope="col" className="aufgaben-th-status">
                                {t("praxis.aufgaben.admin.col_status")}
                            </th>
                            <th scope="col" className="aufgaben-th-action" aria-label={t("praxis.aufgaben.admin.col_action")}>
                                <span className="sr-only">{t("praxis.aufgaben.admin.col_action")}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const patLabel = aufgabePatientLabel(row.patient_id, patientMap);
                            const patId = row.patient_id?.trim() || null;
                            const canOpen = userCanViewAufgabe(row, userId, { isRezeption, canAdmin });
                            const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                                if (!canOpen) return;
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onOpen(row);
                                }
                            };
                            return (
                                <tr
                                    key={row.id}
                                    className={[
                                        "aufgaben-row",
                                        canOpen ? "aufgaben-row--clickable bestellungen-row--clickable" : "aufgaben-row--disabled",
                                    ].join(" ")}
                                    tabIndex={canOpen ? 0 : undefined}
                                    role={canOpen ? "link" : undefined}
                                    aria-label={canOpen ? tp("praxis.aufgaben.open_aria", { title: row.titel }) : undefined}
                                    onClick={canOpen ? () => onOpen(row) : undefined}
                                    onKeyDown={onRowKeyDown}
                                    aria-disabled={!canOpen}
                                >
                                    <td className="aufgaben-td-updated">{formatDateTime(row.updated_at)}</td>
                                    <td className="aufgaben-td-titel">
                                        <span className="aufgaben-titel">{row.titel}</span>
                                        {row.body ? <span className="aufgaben-body-sub">{row.body}</span> : null}
                                        {compact ? (
                                            <span className="aufgaben-meta-sub">
                                                {patLabel}
                                                {row.typ ? ` · ${row.typ}` : ""}
                                                {` · ${assigneeLabel(row, personal)}`}
                                            </span>
                                        ) : null}
                                    </td>
                                    {!compact ? (
                                        <>
                                            <td className="aufgaben-td-patient">
                                                {patId ? (
                                                    <Link
                                                        to={`/patienten/${patId}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {patLabel}
                                                    </Link>
                                                ) : (
                                                    patLabel
                                                )}
                                            </td>
                                            <td className="aufgaben-td-typ">{row.typ}</td>
                                            <td className="aufgaben-td-assignee">{assigneeLabel(row, personal)}</td>
                                        </>
                                    ) : null}
                                    <td className="aufgaben-td-status">
                                        <Badge variant={aufgabeStatusVariant(row.status)}>
                                            {aufgabeStatusLabel(row.status)}
                                        </Badge>
                                    </td>
                                    <td className="aufgaben-td-action" onClick={(e) => e.stopPropagation()}>
                                        <div className="aufgaben-action-inner">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                aria-label={tp("praxis.aufgaben.admin.edit_aria", { title: row.titel })}
                                                onClick={() => onEdit(row)}
                                            >
                                                <EditIcon size={14} aria-hidden />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
