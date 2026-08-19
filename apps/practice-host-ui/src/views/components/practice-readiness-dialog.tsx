import { useT, useTParams } from "@/lib/i18n";
import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import type { DocumentKind } from "@/lib/document-template-schema";
import { practiceReadinessDialogBody, type PracticeReadinessResult } from "@/lib/practice-completeness";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";

type Props = {
    open: boolean;
    documentKind: DocumentKind;
    result: PracticeReadinessResult;
    onClose: () => void;
};

export const PracticeReadinessDialog: FC<Props> = ({ open, documentKind, result, onClose }) => {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    if (!open || result.ready) return null;
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t("practice.readiness.title")}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t("common.cancel")}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            onClose();
                            navigate("/settings?tab=practice");
                        }}
                    >
                        {t("practice.readiness.to_settings")}
                    </Button>
                </>
            }
        >
            <p style={{ margin: 0, lineHeight: 1.5 }}>{practiceReadinessDialogBody(t, tp, documentKind, result.missingFields)}</p>
        </Dialog>
    );
};
