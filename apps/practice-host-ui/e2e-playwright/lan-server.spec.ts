/**
 * T-S3 — LAN browser client smoke (W7).
 *
 * Run with medoc-server + optional Vite dev server:
 *   MEDOC_LAN_E2E=1 MEDOC_LAN_URL=https://127.0.0.1:8787 npm run test:playwright
 *
 * JWT login test uses demo seed: ahmed@praxis.de + TOTP 123456 (see g21-live-smoke-checklist.md).
 */

import { test, expect } from "@playwright/test";

const lanE2e = process.env.MEDOC_LAN_E2E === "1";
const lanUrl = (process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787").replace(/\/$/, "");

test.describe("LAN server public surface", () => {
    test.skip(!lanE2e, "Set MEDOC_LAN_E2E=1 to run against live medoc-server");

    test("health and ping respond", async ({ request }) => {
        const health = await request.get(`${lanUrl}/health`);
        expect(health.ok()).toBeTruthy();
        const healthJson = await health.json();
        expect(healthJson.service).toBe("medoc-lan");

        const ping = await request.get(`${lanUrl}/api/v1/ping`);
        expect(ping.ok()).toBeTruthy();
        const pingJson = await ping.json();
        expect(pingJson.ok).toBe(true);
    });

    test("master-info exposes pubkey", async ({ request }) => {
        const resp = await request.get(`${lanUrl}/api/v1/pairing/master-info`);
        expect(resp.ok()).toBeTruthy();
        const body = await resp.json();
        expect(typeof body.masterPubkey).toBe("string");
        expect(body.masterPubkey.length).toBeGreaterThan(10);
    });

    test("arzt JWT login and /me", async ({ request }) => {
        const login = await request.post(`${lanUrl}/api/v1/auth/login`, {
            data: {
                email: "ahmed@praxis.de",
                passwort: "passwort123",
                totp_code: "123456",
            },
            ignoreHTTPSErrors: true,
        });
        expect(login.ok()).toBeTruthy();
        const loginJson = await login.json();
        const token = loginJson.access_token as string;
        expect(token.length).toBeGreaterThan(10);

        const me = await request.get(`${lanUrl}/api/v1/me`, {
            headers: { Authorization: `Bearer ${token}` },
            ignoreHTTPSErrors: true,
        });
        expect(me.ok()).toBeTruthy();
        const meJson = await me.json();
        expect(meJson.email).toBe("ahmed@praxis.de");
        expect(meJson.rolle).toBe("ARZT");

        const patienten = await request.get(`${lanUrl}/api/v1/patienten`, {
            headers: { Authorization: `Bearer ${token}` },
            ignoreHTTPSErrors: true,
        });
        expect(patienten.ok()).toBeTruthy();
        const list = await patienten.json();
        expect(Array.isArray(list)).toBe(true);
    });
});
