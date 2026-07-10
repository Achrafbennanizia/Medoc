/** Tauri platform layer: attachment preview URLs via `convertFileSrc`. */

import { convertFileSrc } from "@tauri-apps/api/core";

export * from "../../../../packages/shared/src/lib/akte-anlagen";
import { mapAkteAnlageRowFromDto, type AkteAnlage, type AkteAnlageRowDto } from "../../../../packages/shared/src/lib/akte-anlagen";

export function mapAkteAnlageRowDto(r: AkteAnlageRowDto): AkteAnlage {
    return mapAkteAnlageRowFromDto(r, convertFileSrc(r.abs_path));
}
