/** The sections of About & support, in page order, and their element ids. */
export const ABOUT_SECTIONS = ["overview", "device", "network", "data", "support", "legal"] as const;
export type AboutSectionId = (typeof ABOUT_SECTIONS)[number];

export const aboutSectionDomId = (id: AboutSectionId) => `about-${id}`;
