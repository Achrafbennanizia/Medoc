import { useEffect, useState } from "react";
import { loadClientSettings, subscribeClientSettings, type ClientSettingsV1 } from "./client-settings";

/**
 * Reactive client settings: re-renders when settings are saved here or in another app window.
 * Pass a selector to subscribe to one value (cheap equality on primitives).
 */
export function useClientSettings<T = ClientSettingsV1>(select?: (s: ClientSettingsV1) => T): T {
    const pick = (): T => (select ? select(loadClientSettings()) : (loadClientSettings() as unknown as T));
    const [value, setValue] = useState<T>(pick);
    useEffect(() => {
        const update = () => setValue(pick());
        update();
        return subscribeClientSettings(update);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- selector identity is not a dependency
    }, []);
    return value;
}
