import { useT, isRtlLocale, useLocale } from "@/lib/i18n";
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
    const rtl = useLocale((s) => isRtlLocale(s.locale));
    const menuWidth = 240;
    const menuHeight = 320;
    const maxX = typeof window !== "undefined" ? window.innerWidth - menuWidth : x;
    const maxY = typeof window !== "undefined" ? window.innerHeight - menuHeight : y;
    const clampedX = Math.max(8, Math.min(x, maxX));
    const clampedY = Math.max(8, Math.min(y, maxY));
    const left = rtl && typeof window !== "undefined"
        ? Math.max(8, Math.min(window.innerWidth - clampedX - menuWidth, maxX))
        : clampedX;
    const top = clampedY;
    return (
        <div className="menu termin-ctx-menu" style={{ position: "fixed", left, top }}>
            <div className="termin-ctx-title">{patientName}</div>
            <div className="termin-ctx-sub">
                {termin.uhrzeit.slice(0, 5)} · {terminArtLabelFromTermin(termin)}
            </div>
            <button type="button" className="menu-item" onClick={() => { onOpenDetails(); onClose(); }}>{t("termin.context.open_details")}</button>
            <div className="menu-sep" />
            <button type="button" className="menu-item" onClick={() => { onBearbeiten(); onClose(); }}>{t("termin.context.edit")}</button>
            <button type="button" className="menu-item" onClick={() => { onReminder(); onClose(); }}>{t("termin.drawer.reminder")}</button>
            <button type="button" className="menu-item danger" onClick={() => { onStornieren(); onClose(); }}>{t("termin.drawer.cancel")}</button>
        </div>
    );
}
