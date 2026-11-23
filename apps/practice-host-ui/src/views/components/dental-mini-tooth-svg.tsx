/**
 * Compact tooth glyph (record header, appointment tooth picker). The same layered tooth as the
 * examination and treatment chart (`DentalArchToothIcon`), so every combination looks the same
 * everywhere: crown colour, decay dot, filling block, root line or implant screw, dashed outline
 * for planned work, dashed ghost for missing (with a planned or placed implant still visible).
 */
import { type DentalStatusKey } from "@/lib/dental";
import { DentalArchToothIcon } from "./dental-arch-svg";

export function DentalMiniToothSvg({
    fdi,
    stateKey,
    marks,
    selected = false,
    height = 28,
}: {
    fdi: string;
    stateKey: DentalStatusKey;
    /** Every status on the tooth. `stateKey` is the fallback when none is given. */
    marks?: DentalStatusKey[];
    selected?: boolean;
    /** Kept for callers; the width follows the tooth shape. */
    width?: number;
    height?: number;
}) {
    const keys = marks && marks.length > 0 ? marks : [stateKey];
    const upper = fdi.startsWith("1") || fdi.startsWith("2");
    return (
        <DentalArchToothIcon
            fdi={fdi}
            keys={keys}
            height={height}
            selected={selected}
            upper={upper}
            className="dental-mini-tooth-svg"
        />
    );
}
