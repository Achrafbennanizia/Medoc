/** Shapes shared by the dev capture bridge (DEV only; see loop.ts). */
import type { ColorSchemeId } from "@/lib/client-settings";
import type { Locale } from "@/lib/i18n";

/** One command from a screenshot script. Fields are optional; each handler checks what it needs. */
export type CaptureCommand = {
    id?: string;
    op: string;
    href?: string;
    path?: string;
    text?: string;
    selector?: string;
    email?: string;
    password?: string;
    locale?: Locale;
    theme?: ColorSchemeId;
    value?: string;
    width?: number;
    height?: number;
};

export type CaptureResult = Record<string, unknown> & { ok?: boolean };

export type CaptureHandler = (cmd: CaptureCommand) => CaptureResult | Promise<CaptureResult>;

/** Handlers by command name; each command group exports one of these (Open/Closed: add, don't edit). */
export type CaptureCommandGroup = Readonly<Record<string, CaptureHandler>>;

export const missing = (field: string): CaptureResult => ({ ok: false, error: `missing ${field}` });
