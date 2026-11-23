/** Tauri platform layer: attachment preview URLs via `convertFileSrc`. */

import { convertFileSrc } from "@tauri-apps/api/core";

export * from "../../../../packages/shared/src/lib/chart-attachments";
import { mapChartAttachmentRowFromDto, type ChartAttachment, type ChartAttachmentRowDto } from "../../../../packages/shared/src/lib/chart-attachments";

export function mapChartAttachmentRowDto(r: ChartAttachmentRowDto): ChartAttachment {
    // The card shows the small thumbnail when there is one, not the full-resolution original.
    return mapChartAttachmentRowFromDto(r, convertFileSrc(r.thumb_abs_path ?? r.abs_path));
}
