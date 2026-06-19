import { useT } from "@/lib/i18n";
import type { Termin } from "@/models/types";
import { terminArtLabelFromTermin } from "@/lib/termin-calendar-ui";

export type TerminContextMenuProps = {
    termin: Termin;
    x: number;
    y: number;
    patientName: string;
    onClose: () => void;
    onOpenDetails: () => void;
    onBearbeiten: () => void;
    onStornieren: () => void;
    onReminder: () => void;
};

export function TerminContextMenu({
    termin,
    x,
    y,
    patientName,
    onClose,
    onOpenDetails,
    onBearbeiten,
    onStornieren,
    onReminder,
}: TerminContextMenuProps) {
    const t = useT();
    const maxX = typeof window !== "undefined" ? window.innerWidth - 240 : x;
    const maxY = typeof window !== "undefined" ? window.innerHeight - 320 : y;
    const left = Math.max(8, Math.min(x, maxX));
    const top = Math.max(8, Math.min(y, maxY));
    return (
        <div className="menu termin-ctx-menu" style={{ position: "fixed", left, top }}>
            <div className="termin-ctx-title">{patientName}</div>
            <div className="termin-ctx-sub">
                {termin.uhrzeit.slice(0, 5)} · {terminArtLabelFromTermin(termin)}
            </div>
            <button type="button" className="menu-item" onClick={() => { onOpenDetails(); onClose(); }}>{t("termin.context.open_details")}</button>
            <div className="menu-sep" />
            <button type="button" className="menu-item" onClick={() => { onBearbeiten(); onClose(); }}>{t("termin.context.edit")}</button>
            <button type="button" className="menu-item" onClick={() => { onReminder(); onClose(); }}>Erinnerung senden</button>
            <button type="button" className="menu-item danger" onClick={() => { onStornieren(); onClose(); }}>Absagen</button>
        </div>
    );
}
