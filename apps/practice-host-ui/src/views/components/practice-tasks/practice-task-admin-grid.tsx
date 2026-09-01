import { useT, useTParams } from "@/lib/i18n";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { Patient, Staff } from "@/models/types";
import type { PracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { formatDateTime } from "@/lib/utils";
import { EditIcon } from "@/lib/icons";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { taskPatientLabel } from "./constants";
import { assigneeLabel, taskStatusVariant, userCanViewTask } from "./task-workflow";
import { taskStatusLabel, taskKindLabel } from "./task-workflow-ui";

type Props = {
    rows: PracticeTask[];
    patientMap: Map<string, Patient>;
    staff: Staff[];
    userId: string;
    isReception: boolean;
    canAdmin?: boolean;
    /** Fewer columns for the embedded practice tasks tab (fits workspace width). */
    compact?: boolean;
    onOpen: (row: PracticeTask) => void;
    onEdit: (row: PracticeTask) => void;
};

export function PracticeTaskAdminGrid({
    rows,
    patientMap,
    staff,
    userId,
    isReception,
    canAdmin = false,
    compact = false,
    onOpen,
    onEdit,
}: Props) {
    const t = useT();
    const tp = useTParams();
    return (
        <div className="card tasks-table-card tbl-data-card card--overflow-visible">
            <div className="tbl-scroll">
                <table className={`tbl tbl-tasks${compact ? " tbl-tasks--compact" : ""}`}>
                    <colgroup>
                        <col className="tasks-col-updated" />
                        <col className="tasks-col-title" />
                        {!compact ? (
                            <>
                                <col className="tasks-col-patient" />
                                <col className="tasks-col-kind" />
                                <col className="tasks-col-assignee" />
                            </>
                        ) : null}
                        <col className="tasks-col-status" />
                        <col className="tasks-col-action" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th scope="col" className="tasks-th-updated">
                                {t("practice.tasks.admin.col_updated")}
                            </th>
                            <th scope="col" className="tasks-th-title">
                                {t("practice.tasks.admin.col_title")}
                            </th>
                            {!compact ? (
                                <>
                                    <th scope="col" className="tasks-th-patient">
                                        {t("practice.tasks.admin.col_patient")}
                                    </th>
                                    <th scope="col" className="tasks-th-kind">
                                        {t("practice.tasks.admin.col_type")}
                                    </th>
                                    <th scope="col" className="tasks-th-assignee">
                                        {t("practice.tasks.admin.col_assignee")}
                                    </th>
                                </>
                            ) : null}
                            <th scope="col" className="tasks-th-status">
                                {t("practice.tasks.admin.col_status")}
                            </th>
                            <th scope="col" className="tasks-th-action" aria-label={t("practice.tasks.admin.col_action")}>
                                <span className="sr-only">{t("practice.tasks.admin.col_action")}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const patLabel = taskPatientLabel(row.patient_id, patientMap, t("common.dash"));
                            const patId = row.patient_id?.trim() || null;
                            const canOpen = userCanViewTask(row, userId, { isReception, canAdmin });
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
                                        "tasks-row",
                                        canOpen ? "tasks-row--clickable purchase-orders-row--clickable" : "tasks-row--disabled",
                                    ].join(" ")}
                                    tabIndex={canOpen ? 0 : undefined}
                                    role={canOpen ? "link" : undefined}
                                    aria-label={canOpen ? tp("practice.tasks.open_aria", { title: row.title }) : undefined}
                                    onClick={canOpen ? () => onOpen(row) : undefined}
                                    onKeyDown={onRowKeyDown}
                                    aria-disabled={!canOpen}
                                >
                                    <td className="tasks-td-updated">{formatDateTime(row.updated_at)}</td>
                                    <td className="tasks-td-title">
                                        <span className="tasks-title">{row.title}</span>
                                        {row.body ? <span className="tasks-body-sub">{row.body}</span> : null}
                                        {compact ? (
                                            <span className="tasks-meta-sub">
                                                {patLabel}
                                                {row.kind ? ` · ${taskKindLabel(t, row.kind)}` : ""}
                                                {` · ${assigneeLabel(row, staff, t)}`}
                                            </span>
                                        ) : null}
                                    </td>
                                    {!compact ? (
                                        <>
                                            <td className="tasks-td-patient">
                                                {patId ? (
                                                    <Link
                                                        to={`/patients/${patId}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {patLabel}
                                                    </Link>
                                                ) : (
                                                    patLabel
                                                )}
                                            </td>
                                            <td className="tasks-td-kind">{taskKindLabel(t, row.kind)}</td>
                                            <td className="tasks-td-assignee">{assigneeLabel(row, staff, t)}</td>
                                        </>
                                    ) : null}
                                    <td className="tasks-td-status">
                                        <Badge variant={taskStatusVariant(row.status)}>
                                            {taskStatusLabel(t, row.status)}
                                        </Badge>
                                    </td>
                                    <td className="tasks-td-action" onClick={(e) => e.stopPropagation()}>
                                        <div className="tasks-action-inner">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                aria-label={tp("practice.tasks.admin.edit_aria", { title: row.title })}
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