/** Tauri platform layer: attachment preview URLs via `convertFileSrc`. */

import { convertFileSrc } from "@tauri-apps/api/core";

export * from "../../../../packages/shared/src/lib/chart-attachments";
import { mapChartAttachmentRowFromDto, type ChartAttachment, type ChartAttachmentRowDto } from "../../../../packages/shared/src/lib/chart-attachments";

export function mapChartAttachmentRowDto(r: ChartAttachmentRowDto): ChartAttachment {
    return mapChartAttachmentRowFromDto(r, convertFileSrc(r.abs_path));
}
