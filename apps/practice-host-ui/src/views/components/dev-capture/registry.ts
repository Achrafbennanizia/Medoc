/** All bridge commands by name. A new command goes into one group; nothing else changes. */
import { appearanceCommands } from "./commands/appearance";
import { inspectCommands } from "./commands/inspect";
import { navigationCommands } from "./commands/navigation";
import { sessionCommands } from "./commands/session";
import { windowCommands } from "./commands/window";
import type { CaptureCommand, CaptureCommandGroup, CaptureResult } from "./types";

export const CAPTURE_COMMANDS: CaptureCommandGroup = {
    ...sessionCommands,
    ...navigationCommands,
    ...windowCommands,
    ...appearanceCommands,
    ...inspectCommands,
};

/** Runs a command; unknown names and thrown errors become `{ ok: false }` results, never exceptions. */
export async function runCaptureCommand(cmd: CaptureCommand, commands: CaptureCommandGroup = CAPTURE_COMMANDS): Promise<CaptureResult> {
    const handler = commands[cmd.op];
    if (!handler) return { ok: false, op: cmd.op, error: `unknown command "${cmd.op}"` };
    try {
        return { ok: true, op: cmd.op, ...(await handler(cmd)) };
    } catch (e) {
        return { ok: false, op: cmd.op, error: String(e) };
    }
}
