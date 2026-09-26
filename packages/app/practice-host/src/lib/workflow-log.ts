import { ipcErrorRaw } from "@/lib/ipc-errors";

const ROUTE_ID_PREDECESSORS = new Set([
    "patients",
    "tickets",
    "prescriptions",
    "certificates",
    "purchase-orders",
    "templates",
    "editor",
]);
const UUID_SEGMENT_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT_RE = /^\d+$/;

function cleanToken(value: string): string {
    const compact = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._:/-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    return compact.slice(0, 96);
}

export function normalizeWorkflowToken(value: string, fallback: string): string {
    const cleaned = cleanToken(value);
    return cleaned.length > 0 ? cleaned : fallback;
}

export function normalizeWorkflowRoute(pathname: string): string {
    if (!pathname || pathname === "/") return "/";
    const rawParts = pathname.split("/").filter(Boolean);
    const out: string[] = [];
    for (let i = 0; i < rawParts.length; i += 1) {
        const raw = rawParts[i];
        const lower = raw.toLowerCase();
        const prev = i > 0 ? rawParts[i - 1].toLowerCase() : "";
        if (
            ROUTE_ID_PREDECESSORS.has(prev) ||
            UUID_SEGMENT_RE.test(lower) ||
            NUMERIC_SEGMENT_RE.test(lower)
        ) {
            out.push(":id");
            continue;
        }
        const safe = cleanToken(lower);
        out.push(safe.length > 0 ? safe : "unknown");
    }
    return `/${out.join("/")}`;
}

export function extractWorkflowErrorCode(error: unknown): string {
    const raw = ipcErrorRaw(error).trim();
    const coded = raw.match(/\berror\.[a-z0-9_.]+\b/i)?.[0];
    return coded ? coded.toLowerCase() : "error.unknown";
}
