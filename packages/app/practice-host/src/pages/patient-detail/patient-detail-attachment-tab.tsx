import { useT } from "@/lib/i18n";
import type { ChartAttachment } from "@/lib/chart-attachments";
import { ChartAttachmentsPanel } from "@/views/components/chart-attachments-panel";
import { Card } from "@/views/components/ui/card";

export type PatientDetailAttachmentTabProps = {
    hasAttachments: boolean;
    attachments: ChartAttachment[];
    fileInputId: string;
    cameraInputId: string;
    canManageAttachments: boolean;
    canValidate: boolean;
    onPickFile: (file: File) => void;
    onRename: (idx: number, name: string) => void;
    onSetDocumentKind?: (idx: number, kind: string) => void;
    onRequestRemove: (idx: number, name: string) => void;
    onOpenExternal: (idx: number) => void;
    onDuplicate?: (idx: number) => void;
    isValidated: (attachmentId: string) => boolean;
    onRequestValidate: (attachmentId: string, label: string) => void;
    onRevokeValidation: (attachmentId: string, shortLabel: string) => void;
    formatAddedAt: (iso: string) => string;
    onScannerClick: () => void;
};

export function PatientDetailAttachmentTab({
    hasAttachments,
    attachments,
    fileInputId,
    cameraInputId,
    canManageAttachments,
    canValidate,
    onPickFile,
    onRename,
    onSetDocumentKind,
    onRequestRemove,
    onOpenExternal,
    onDuplicate,
    isValidated,
    onRequestValidate,
    onRevokeValidation,
    formatAddedAt,
    onScannerClick,
}: PatientDetailAttachmentTabProps) {
    const t = useT();
    return (
        <div id="panel-attachment" role="tabpanel" aria-labelledby="tab-attachment">
            <Card className="card-pad">
                <ChartAttachmentsPanel
                    subtitle={
                        hasAttachments
                            ? t("patient.attachment.menu_hint")
                            : t("patient.attachment.empty_title")
                    }
                    attachments={attachments}
                    fileInputId={fileInputId}
                    cameraInputId={cameraInputId}
                    canManageAttachments={canManageAttachments}
                    onPickFile={onPickFile}
                    onRename={onRename}
                    onSetDocumentKind={onSetDocumentKind}
                    onRequestRemove={onRequestRemove}
                    onOpenExternal={onOpenExternal}
                    onDuplicate={onDuplicate}
                    canValidate={canValidate}
                    isValidated={isValidated}
                    onRequestValidate={onRequestValidate}
                    onRevokeValidation={onRevokeValidation}
                    formatAddedAt={formatAddedAt}
                    onScannerClick={onScannerClick}
                />
            </Card>
        </div>
    );
}
