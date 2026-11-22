/** Translation keys for the access model (texts live in the locale files under `access.*`). */
import type { AccessAreaId, AccessLevel } from "@/systems/practice-host/controllers/access.controller";

export const areaLabelKey = (a: AccessAreaId) => `access.area.${a}.label`;
export const areaHintKey = (a: AccessAreaId) => `access.area.${a}.hint`;
export const levelLabelKey = (l: AccessLevel) => `access.level.${l}.label`;
export const levelHintKey = (l: AccessLevel) => `access.level.${l}.hint`;
/** What one level allows in one area, in plain words. */
export const privilegeKey = (a: AccessAreaId, l: AccessLevel) => `access.area.${a}.level.${l}`;
export const roleLabelKey = (id: string) => `access.role.${id.replace(".", "_")}.label`;
export const roleDescriptionKey = (id: string) => `access.role.${id.replace(".", "_")}.description`;

export const LEVEL_ORDER: readonly AccessLevel[] = ["none", "view", "edit", "create", "full"];
export const levelRank = (l: AccessLevel) => LEVEL_ORDER.indexOf(l);
