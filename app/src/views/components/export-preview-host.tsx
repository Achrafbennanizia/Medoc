import { useExportPreviewStore } from "@/models/store/export-preview-store";
import { ExportPreviewDialog } from "./export-preview-dialog";

/** Global host: mount once in `AppLayout` next to toasts. */
export function ExportPreviewHost() {
    const open = useExportPreviewStore((s) => s.open);
    const payload = useExportPreviewStore((s) => s.payload);
    const close = useExportPreviewStore((s) => s.close);
    if (!open || !payload) return null;
    return <ExportPreviewDialog payload={payload} onClose={close} />;
}
