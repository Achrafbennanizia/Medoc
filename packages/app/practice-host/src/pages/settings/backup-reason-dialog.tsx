/** Reason dialog for backup actions, and byte formatting. */
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { Button } from "@/views/components/ui/button";
import { Dialog } from "@/views/components/ui/dialog";
import { Textarea } from "@/views/components/ui/input";

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** A dialog that asks for a reason; the reason goes into the audit log with the action. */
export function ReasonDialog({
    open,
    title,
    message,
    confirmLabel,
    danger,
    busy,
    onClose,
    onConfirm,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    busy: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}) {
    const t = useT();
    const [reason, setReason] = useState("");
    useEffect(() => {
        if (open) setReason("");
    }, [open]);
    const ok = reason.trim().length >= 3;
    return (
        <Dialog
            open={open}
            onClose={busy ? () => undefined : onClose}
            title={title}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="button" variant={danger ? "danger" : "primary"} onClick={() => onConfirm(reason.trim())} disabled={!ok || busy}>
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            <p className="card-sub" style={{ marginTop: 0 }}>
                {message}
            </p>
            <Textarea
                label={t("settings.backups.reason_label")}
                placeholder={t("settings.backups.reason_hint")}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
            />
        </Dialog>
    );
}

/**
 * Settings → Backups (practice administrator, `ops.backup`).
 * Automatic daily backup, rotated to 3 daily + last week + last half-year; compressed and
 * encrypted. Every action here is written to the audit log with who, when and why.
 */
