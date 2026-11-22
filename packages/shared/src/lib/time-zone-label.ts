/** Localized IANA timezone labels for Settings (en, de, fr, ar). */

const LTR = "\u2066";
const PDF = "\u2069";

function displayNameFromIntl(timeZone: string, localeTag: string): string | null {
    try {
        const names = new Intl.DisplayNames([localeTag], {
            type: "timeZone",
        } as unknown as Intl.DisplayNamesOptions);
        const version = names.of(timeZone)?.trim();
        if (version) return version;
    } catch {
        /* DisplayNames does not support type: timeZone in this runtime */
    }
    for (const timeZoneName of ["longGeneric", "long"] as const) {
        try {
            const part = new Intl.DateTimeFormat(localeTag, { timeZone, timeZoneName })
                .formatToParts(new Date())
                .find((p) => p.type === "timeZoneName")
                ?.value.trim();
            if (part && part !== timeZone) return part;
        } catch {
            /* invalid zone or unsupported timeZoneName */
        }
    }
    return null;
}

/** Human name in `localeTag`, or the IANA id if the runtime cannot translate it. */
export function timeZoneDisplayName(timeZone: string, localeTag: string): string {
    return displayNameFromIntl(timeZone, localeTag) ?? timeZone;
}

/** Option copy: localized name plus the IANA id. The id stays left-to-right in Arabic. */
export function timeZoneOptionLabel(timeZone: string, localeTag: string): string {
    const rtl = localeTag.toLowerCase().startsWith("ar");
    const id = rtl ? `${LTR}${timeZone}${PDF}` : timeZone;
    const name = timeZoneDisplayName(timeZone, localeTag);
    if (name === timeZone) return id;
    return `${name} (${id})`;
}
