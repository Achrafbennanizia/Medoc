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
import type { PracticeSystemPort } from "../ports/practice-system.port";

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
    return msg;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Command → LAN REST route (Strategy map). */
const LAN_COMMAND_ROUTES: Partial<
    Record<string, { method: HttpMethod; path: string | ((args: Record<string, unknown>) => string) }>
> = {
    get_session: { method: "GET", path: "/api/v1/me" },
    get_own_profile: { method: "GET", path: "/api/v1/me" },
    login: { method: "POST", path: "/api/v1/auth/login" },
    logout: { method: "POST", path: "/api/v1/auth/login" }, // no-op over HTTP; session is JWT-only
    list_patienten: { method: "GET", path: "/api/v1/patienten" },
    list_termine: {
        method: "GET",
        path: (args) => {
            const datum = args.datum;
            return datum != null && String(datum).length > 0
                ? `/api/v1/termine?datum=${encodeURIComponent(String(datum))}`
                : "/api/v1/termine";
        },
    },
    list_termine_by_date: {
        method: "GET",
        path: (args) =>
            `/api/v1/termine?datum=${encodeURIComponent(String(args.datum ?? ""))}`,
    },
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
                    passwort: args?.passwort ?? args?.password,
                    totp_code: args?.totp_code ?? null,
                });
            } else if (command === "set_app_kv") {
                init.body = JSON.stringify({ key: args?.key, value: args?.value });
            } else {
                init.body = JSON.stringify(args ?? {});
            }
        }

        const res = await fetch(url, init);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`LAN HTTP ${res.status}: ${text.slice(0, 400)}`);
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
                rolle: string;
            };
            return {
                user_id: u.user_id,
                email: u.email,
                name: u.name,
                rolle: u.rolle,
            } as T;
        }

        if (command === "get_session") {
            const record = body as Record<string, unknown>;
            return {
                user_id: record.user_id as string,
                email: record.email as string,
                name: record.name as string,
                rolle: record.rolle as string,
            } as T;
        }

        if (command === "get_own_profile") {
            return body as T;
        }

        return body as T;
    }
}
