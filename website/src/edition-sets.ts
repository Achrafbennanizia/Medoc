import type { EditionId } from "./route";

/** Which editions have a feature: all three, the team editions, or Cabinet+ only. */
export const ALL: EditionId[] = ["essentiel", "cabinet", "cabinet-plus"];
export const TEAM: EditionId[] = ["cabinet", "cabinet-plus"];
export const PLUS: EditionId[] = ["cabinet-plus"];
