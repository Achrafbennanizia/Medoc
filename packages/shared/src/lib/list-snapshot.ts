const snapshots = new Map<string, unknown>();

/** Last successful list payload, so a page can paint before the next fetch returns. */
export function readListSnapshot<T>(key: string): T | undefined {
    return snapshots.get(key) as T | undefined;
}

export function writeListSnapshot<T>(key: string, value: T): void {
    snapshots.set(key, value);
}
