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

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Command → LAN REST route (Strategy map). */
const LAN_COMMAND_ROUTES: Partial<
    Record<string, { method: HttpMethod; path: string | ((args: Record<string, unknown>) => string) }>
> = {
    get_session: { method: "GET", path: "/api/v1/me" },
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
    constructor(private readonly cfg: LanClientConfigV1 = loadLanClientConfig()) {
        if (!isLanClientActive(cfg)) {
            throw new Error("LAN-Client-Konfiguration unvollständig (Basis-URL oder Token fehlt).");
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
                `LAN-Client: Befehl "${command}" ist am API-Server nicht verfügbar — Praxis-Host-Desktop nutzen.`,
            );
        }
        const path =
            typeof route.path === "function" ? route.path(args ?? {}) : route.path;
        const url = `${this.cfg.baseUrl}${path}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.cfg.accessToken}`,
            Accept: "application/json",
        };
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
        const body = (await res.json()) as Record<string, unknown>;

        if (command === "login") {
            const token = body.access_token as string | undefined;
            if (token) {
                saveLanClientConfig({ ...this.cfg, accessToken: token, enabled: true });
            }
            const u = (body.user ?? body) as {
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
            return {
                user_id: body.user_id as string,
                email: body.email as string,
                name: body.name as string,
                rolle: body.rolle as string,
            } as T;
        }

        return body as T;
    }
}
