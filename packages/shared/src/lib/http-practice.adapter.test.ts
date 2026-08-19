import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpPracticeAdapter } from "@/systems/practice-host/adapters/http-practice.adapter";
import {
    EMPTY_LAN_CLIENT_CONFIG,
    loadLanClientConfig,
} from "@/systems/lan/lib/lan-client-config";

const activeLanConfig = {
    schemaVersion: 1 as const,
    enabled: true,
    baseUrl: "https://127.0.0.1:8787",
    accessToken: "initial-token",
};

describe("HttpPracticeAdapter", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("rejects incomplete LAN config", () => {
        expect(() => new HttpPracticeAdapter(EMPTY_LAN_CLIENT_CONFIG)).toThrow(/base URL missing/);
    });

    it("rejects unmapped IPC commands", () => {
        const adapter = new HttpPracticeAdapter(activeLanConfig);
        expect(adapter.invoke("get_patient", { id: "x" })).rejects.toThrow(/not available on the API server/);
    });

    it("login posts credentials and persists access_token (LAN client flow)", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                access_token: "jwt-from-lan-server",
                user: {
                    user_id: "u-lan-1",
                    email: "physician@practice.de",
                    name: "Dr. LAN",
                    role: "PHYSICIAN",
                },
            }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const adapter = new HttpPracticeAdapter(activeLanConfig);
        const session = await adapter.invoke<{
            user_id: string;
            email: string;
            name: string;
            role: string;
        }>("login", { email: "physician@practice.de", password: "geheim" });

        expect(session).toEqual({
            user_id: "u-lan-1",
            email: "physician@practice.de",
            name: "Dr. LAN",
            role: "PHYSICIAN",
        });
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://127.0.0.1:8787/api/v1/auth/login");
        expect(init.method).toBe("POST");
        expect(init.body).toBe(
            JSON.stringify({
                email: "physician@practice.de",
                password: "geheim",
                totp_code: null,
            }),
        );
        expect(loadLanClientConfig().accessToken).toBe("jwt-from-lan-server");
        expect(loadLanClientConfig().enabled).toBe(true);
    });
});
