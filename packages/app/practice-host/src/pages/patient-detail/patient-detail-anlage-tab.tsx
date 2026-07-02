import { useT } from "@/lib/i18n";
import type { AkteAnlage } from "@/lib/akte-anlagen";
import { AkteAnlagenPanel } from "@/views/components/akte-anlagen-panel";
import { Card } from "@/views/components/ui/card";

export type PatientDetailAnlageTabProps = {
    hasAnlagen: boolean;
    anlagen: AkteAnlage[];
    fileInputId: string;
    cameraInputId: string;
    canManageAnlagen: boolean;
    canValidate: boolean;
    onPickFile: (file: File) => void;
    onRename: (idx: number, name: string) => void;
    onRequestRemove: (idx: number, name: string) => void;
    onOpenExternal: (idx: number) => void;
    onDuplicate?: (idx: number) => void;
    isValidated: (anlageId: string) => boolean;
    onRequestValidate: (anlageId: string, label: string) => void;
    onRevokeValidation: (anlageId: string, shortLabel: string) => void;
    formatAddedAt: (iso: string) => string;
    onScannerClick: () => void;
};

export function PatientDetailAnlageTab({
    hasAnlagen,
    anlagen,
    fileInputId,
    cameraInputId,
    canManageAnlagen,
    canValidate,
    onPickFile,
    onRename,
    onRequestRemove,
    onOpenExternal,
    onDuplicate,
    isValidated,
    onRequestValidate,
    onRevokeValidation,
    formatAddedAt,
    onScannerClick,
}: PatientDetailAnlageTabProps) {
    const t = useT();
    return (
        <div id="panel-anlage" role="tabpanel" aria-labelledby="tab-anlage">
            <Card className="card-pad">
                <AkteAnlagenPanel
                    subtitle={
                        hasAnlagen
                            ? t("patient.anlage.menu_hint")
                            : t("patient.anlage.empty_title")
                    }
                    anlagen={anlagen}
                    fileInputId={fileInputId}
                    cameraInputId={cameraInputId}
                    canManageAnlagen={canManageAnlagen}
                    onPickFile={onPickFile}
                    onRename={onRename}
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
