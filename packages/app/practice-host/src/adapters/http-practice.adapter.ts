/**
 * **Adapter** — Practice Host over LAN HTTPS (subset of Tauri commands).
 * Unmapped commands throw — full desktop host must use Tauri IPC.
 */
import {
    isLanClientActive,
    loadLanClientConfig,
    saveLanClientConfig,
    type LanClientConfigV1,
} from "@/systems/lan/lib/lan-client-config";
import { formatIpcError } from "@/lib/ipc-errors";
import type { PracticeSystemPort } from "../ports/practice-system.port";
import { enqueueWrite, flushQueuedWrites, queuedValue, type QueuedWrite, type ReplayResult } from "./offline-write-queue";

/** Setting writes are kept offline and replayed later (store-and-forward). */
const QUEUEABLE = new Set(["set_app_kv", "delete_app_kv"]);
const isOfflineError = (e: unknown) => /^error\.app\.(network|timeout)/.test(e instanceof Error ? e.message : String(e));

type TFn = (key: string) => string;
type TParamsFn = (key: string, params: Record<string, string | number>) => string;

/** Map English LAN adapter throws to catalog keys for user-visible error boundaries. */
export function formatLanPracticeError(e: unknown, t: TFn, tp?: TParamsFn): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("base URL missing")) return t("error.lan.config_missing_url");
    if (msg.includes("base URL or token missing")) return t("error.lan.config_incomplete");
    const cmdMatch = msg.match(/LAN client: command "([^"]+)"/);
    if (cmdMatch) {
        return tp
            ? tp("error.lan.command_unavailable", { command: cmdMatch[1]! })
            : msg;
    }
    const httpMatch = msg.match(/^LAN HTTP (\d+): ([\s\S]*)$/);
    if (httpMatch) {
        return tp
            ? tp("error.lan.http_error", { status: httpMatch[1]!, detail: httpMatch[2]!.slice(0, 200) })
            : msg;
    }
    return formatIpcError(e);
}

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** A LAN request must never hang the UI: abort after this and surface `error.app.timeout`. */
const LAN_REQUEST_TIMEOUT_MS = 15_000;
const CODED_TOKEN_RE = /^error\.[a-z0-9_.]+(\|.*)?$/i;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: ctrl.signal });
    } catch (e) {
        if (ctrl.signal.aborted) throw new Error("error.app.timeout");
        throw new Error(`error.app.network|detail=${e instanceof Error ? e.message : String(e)}`);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * The LAN server returns `{ "error": "<wire token>" }` — the same token the desktop host sends over IPC.
 * Pass it through unchanged so one resolver (`resolveAppError`) handles both transports.
 */
async function lanErrorFromResponse(res: Response): Promise<string> {
    const text = await res.text().catch(() => "");
    try {
        const body = JSON.parse(text) as { error?: unknown };
        if (typeof body.error === "string" && CODED_TOKEN_RE.test(body.error.trim())) return body.error.trim();
        if (typeof body.error === "string") return `LAN HTTP ${res.status}: ${body.error.slice(0, 400)}`;
    } catch {
        /* not JSON */
    }
    return `LAN HTTP ${res.status}: ${text.slice(0, 400)}`;
}

/** Command → LAN REST route (Strategy map). */
const LAN_COMMAND_ROUTES: Partial<
    Record<string, { method: HttpMethod; path: string | ((args: Record<string, unknown>) => string) }>
> = {
    get_session: { method: "GET", path: "/api/v1/me" },
    get_own_profile: { method: "GET", path: "/api/v1/me" },
    login: { method: "POST", path: "/api/v1/auth/login" },
    get_app_kv: {
        method: "GET",
        path: (args) => `/api/v1/app-kv?key=${encodeURIComponent(String(args.key ?? ""))}`,
    },
    set_app_kv: { method: "PUT", path: "/api/v1/app-kv" },
    delete_app_kv: {
        method: "DELETE",
        path: (args) => `/api/v1/app-kv?key=${encodeURIComponent(String(args.key ?? ""))}`,
    },
};

export class HttpPracticeAdapter implements PracticeSystemPort {
    constructor(
        private readonly cfg: LanClientConfigV1 = loadLanClientConfig(),
        opts?: { allowMissingToken?: boolean },
    ) {
        const hasUrl = cfg.baseUrl.trim().length > 0;
        if (!hasUrl) {
            throw new Error("LAN client configuration incomplete (base URL missing).");
        }
        if (!opts?.allowMissingToken && !isLanClientActive(cfg)) {
            throw new Error("LAN client configuration incomplete (base URL or token missing).");
        }
    }

    async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        if (command === "get_app_kv") {
            const pending = queuedValue(String(args?.key ?? ""));
            if (pending !== undefined) return pending as T;
        }
        try {
            const out = await this.send<T>(command, args);
            if (command !== "logout") void this.replayQueued();
            return out;
        } catch (e) {
            if (!QUEUEABLE.has(command) || !isOfflineError(e)) throw e;
            const key = String(args?.key ?? "");
            // Resolves once the write is on disk, so a shutdown right after cannot lose it.
            await enqueueWrite({ command: command as QueuedWrite["command"], key, value: args?.value as string | undefined });
            return undefined as T;
        }
    }

    /** Send queued offline writes once the main device answers again. */
    replayQueued(): Promise<number> {
        return flushQueuedWrites(async (w): Promise<ReplayResult> => {
            try {
                await this.send(w.command, { key: w.key, value: w.value, editedAt: w.editedAt });
                return "sent";
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                // Not reachable, or signed out: keep the write for the next attempt.
                if (isOfflineError(e) || /unauthorized|forbidden|LAN HTTP 40[13]\b/i.test(msg)) return "offline";
                // 409: a newer value is stored (LWW). Other refusals would fail on every replay.
                return "superseded";
            }
        });
    }

    private async send<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        if (command === "logout") {
            saveLanClientConfig({ ...this.cfg, accessToken: "" });
            return undefined as T;
        }

        const route = LAN_COMMAND_ROUTES[command];
        if (!route) {
            throw new Error(
                `LAN client: command "${command}" is not available on the API server — use the practice host desktop app.`,
            );
        }
        const path =
            typeof route.path === "function" ? route.path(args ?? {}) : route.path;
        const url = `${this.cfg.baseUrl}${path}`;
        const headers: Record<string, string> = {
            Accept: "application/json",
        };
        if (this.cfg.accessToken.trim().length > 0) {
            headers.Authorization = `Bearer ${this.cfg.accessToken}`;
        }
        const init: RequestInit = { method: route.method, headers };

        if (route.method === "POST" || route.method === "PUT" || route.method === "PATCH") {
            headers["Content-Type"] = "application/json";
            if (command === "login") {
                init.body = JSON.stringify({
                    email: args?.email,
                    password: args?.password,
                    totp_code: args?.totp_code ?? null,
                });
            } else if (command === "set_app_kv") {
                init.body = JSON.stringify({ key: args?.key, value: args?.value, editedAt: args?.editedAt });
            } else {
                init.body = JSON.stringify(args ?? {});
            }
        }

        const res = await fetchWithTimeout(url, init, LAN_REQUEST_TIMEOUT_MS);
        if (!res.ok) {
            throw new Error(await lanErrorFromResponse(res));
        }
        if (res.status === 204) {
            return undefined as T;
        }
        const body: unknown = await res.json();

        if (command === "login") {
            const record = body as Record<string, unknown>;
            const token = record.access_token as string | undefined;
            if (token) {
                saveLanClientConfig({ ...this.cfg, accessToken: token, enabled: true });
            }
            const u = (record.user ?? record) as {
                user_id: string;
                email: string;
                name: string;
                role: string;
            };
            return {
                user_id: u.user_id,
                email: u.email,
                name: u.name,
                role: u.role,
            } as T;
        }

        if (command === "get_session") {
            const record = body as Record<string, unknown>;
            return {
                user_id: record.user_id as string,
                email: record.email as string,
                name: record.name as string,
                role: record.role as string,
            } as T;
        }

        if (command === "get_own_profile") {
            return body as T;
        }

        return body as T;
    }
}
