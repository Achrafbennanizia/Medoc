/**
 * IPC JSON field names are English. These helpers are identity maps
 * kept so call sites do not need a coordinated delete.
 */

export function argsToIpc(_command: string, args?: Record<string, unknown>): Record<string, unknown> | undefined {
    return args;
}

export function resultFromIpc<T>(_command: string, result: T): T {
    return result;
}
