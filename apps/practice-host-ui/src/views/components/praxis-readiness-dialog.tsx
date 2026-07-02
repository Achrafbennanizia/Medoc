import { useT, useTParams } from "@/lib/i18n";
import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import type { DocumentKind } from "@/lib/document-template-schema";
import { praxisReadinessDialogBody, type PraxisReadinessResult } from "@/lib/praxis-completeness";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";

type Props = {
    open: boolean;
    documentKind: DocumentKind;
    result: PraxisReadinessResult;
    onClose: () => void;
};

export const PraxisReadinessDialog: FC<Props> = ({ open, documentKind, result, onClose }) => {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    if (!open || result.ready) return null;
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t("praxis.readiness.title")}
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t("common.cancel")}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            onClose();
                            navigate("/einstellungen?tab=praxis");
                        }}
                    >
                        {t("praxis.readiness.to_settings")}
                    </Button>
                </>
            }
        >
            <p style={{ margin: 0, lineHeight: 1.5 }}>{praxisReadinessDialogBody(t, tp, documentKind, result.missingFields)}</p>
        </Dialog>
    );
};
