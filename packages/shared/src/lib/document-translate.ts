/**
 * Translate into the *document* language (Settings → documents), which can differ from the screen
 * language. Used by every printed or exported document.
 */
import { documentLocaleForI18n } from "./document-locale";
import { translateLocale, translateLocaleParams } from "./i18n";

export const docT = (key: string): string => translateLocale(documentLocaleForI18n(), key);
export const docTp = (key: string, params: Record<string, string | number>): string =>
    translateLocaleParams(documentLocaleForI18n(), key, params);
