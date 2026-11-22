/** A set of change listeners: `subscribe` returns its own unsubscribe, `notify` calls every listener. */
export function createListenerSet(): { subscribe: (listener: () => void) => () => void; notify: () => void } {
    const listeners = new Set<() => void>();
    return {
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        notify: () => listeners.forEach((fn) => fn()),
    };
}
