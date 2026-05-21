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
    const navigate = useNavigate();
    if (!open || result.ready) return null;
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Praxis-Stammdaten unvollständig"
            footer={
                <>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Abbrechen
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            onClose();
                            navigate("/einstellungen?tab=praxis");
                        }}
                    >
                        Zu den Einstellungen
                    </Button>
                </>
            }
        >
            <p style={{ margin: 0, lineHeight: 1.5 }}>{praxisReadinessDialogBody(documentKind, result.missingFields)}</p>
        </Dialog>
    );
};
