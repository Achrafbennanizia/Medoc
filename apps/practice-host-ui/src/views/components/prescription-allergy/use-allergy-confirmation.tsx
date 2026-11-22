/**
 * Allergy warning for the prescription screens. `confirmAllergy` opens the dialog and resolves
 * `true` when the doctor chooses to issue anyway; render `allergyDialog` once in the screen.
 */
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useT, useTParams } from "@/lib/i18n";
import type { AllergyConflictInfo, ConfirmAllergy } from "@/lib/with-allergy-confirmation";
import { ConfirmDialog } from "@/views/components/ui/dialog";

export function useAllergyConfirmation(): { confirmAllergy: ConfirmAllergy; allergyDialog: ReactNode } {
    const t = useT();
    const tp = useTParams();
    const [conflict, setConflict] = useState<AllergyConflictInfo | null>(null);
    const resolver = useRef<((issue: boolean) => void) | null>(null);

    const confirmAllergy = useCallback<ConfirmAllergy>(
        (c) =>
            new Promise<boolean>((resolve) => {
                resolver.current = resolve;
                setConflict(c);
            }),
        [],
    );

    const answer = (issue: boolean) => {
        resolver.current?.(issue);
        resolver.current = null;
        setConflict(null);
    };

    const allergyDialog = (
        <ConfirmDialog
            open={conflict !== null}
            onClose={() => answer(false)}
            onConfirm={() => answer(true)}
            title={t("prescription.allergy.confirm_title")}
            message={conflict ? tp("prescription.allergy.confirm_body", { substance: conflict.substance, allergen: conflict.allergen }) : ""}
            confirmLabel={t("prescription.allergy.confirm_issue")}
            danger
        />
    );

    return { confirmAllergy, allergyDialog };
}
