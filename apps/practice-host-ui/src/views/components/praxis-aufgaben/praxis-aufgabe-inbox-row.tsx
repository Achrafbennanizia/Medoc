import type { PraxisAufgabe } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { aufgabeStatusVariant } from "./aufgabe-workflow";
import { useT } from "@/lib/i18n";
import { aufgabeStatusLabel, aufgabeTypLabel } from "./aufgabe-workflow-ui";

type Props = {
    aufgabe: PraxisAufgabe;
    patientName: string;
    selected?: boolean;
    canOpen?: boolean;
    onOpen: () => void;
};

export function PraxisAufgabeInboxRow({
    aufgabe,
    patientName,
    selected = false,
    canOpen = true,
    onOpen,
}: Props) {
    const t = useT();
    return (
        <button
            type="button"
            className={[
                "praxis-aufgabe-inbox-row",
                selected ? "praxis-aufgabe-inbox-row--selected" : "",
                !canOpen ? "praxis-aufgabe-inbox-row--disabled" : "",
            ]
                .filter(Boolean)
                .join(" ")}
            onClick={canOpen ? onOpen : undefined}
            disabled={!canOpen}
            aria-pressed={canOpen ? selected : undefined}
            aria-disabled={!canOpen}
        >
            <div className="praxis-aufgabe-inbox-row__main">
                <div className="praxis-aufgabe-inbox-row__title">{aufgabe.titel}</div>
                <div className="praxis-aufgabe-inbox-row__sub">
                    {patientName} · {aufgabeTypLabel(t, aufgabe.typ)} · {formatDateTime(aufgabe.updated_at)}
                </div>
                {aufgabe.body ? <div className="praxis-aufgabe-inbox-row__preview">{aufgabe.body}</div> : null}
            </div>
            <Badge variant={aufgabeStatusVariant(aufgabe.status)}>{aufgabeStatusLabel(t, aufgabe.status)}</Badge>
        </button>
    );
}