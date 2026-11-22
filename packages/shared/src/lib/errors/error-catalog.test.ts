import { describe, expect, it } from "vitest";
import de from "#shared-locales/de.json";
import en from "#shared-locales/en.json";
import fr from "#shared-locales/fr.json";
import ar from "#shared-locales/ar.json";
import { ERROR_CATALOG } from "./error-catalog";
import { ERROR_KINDS } from "./error-types";
import { errorDomainLabelKey, errorKindActionKey, errorKindCauseKey, resolveAppError } from "./index";

const LOCALES: Record<string, Record<string, string>> = { en, de, fr, ar };

describe("error catalog", () => {
    it("has unique codes and keys in MD-XXX-NNN format", () => {
        const codes = new Set<string>();
        const keys = new Set<string>();
        for (const e of ERROR_CATALOG) {
            expect(e.code).toMatch(/^MD-[A-Z]{3,4}-\d{3}$/);
            expect(codes.has(e.code), e.code).toBe(false);
            codes.add(e.code);
            if (e.origin === "feature") continue; // all features share error.app.feature_disabled
            expect(keys.has(e.key), e.key).toBe(false);
            keys.add(e.key);
        }
    });

    it("translates every message, kind and domain in all locales", () => {
        for (const [loc, cat] of Object.entries(LOCALES)) {
            for (const e of ERROR_CATALOG) {
                if (e.origin && !e.translated) continue; // technical checks: generic text + own code
                expect(cat[e.key], `${loc}:${e.key}`).toBeTruthy();
                expect(cat[errorDomainLabelKey(e.domain)], `${loc}:domain ${e.domain}`).toBeTruthy();
            }
            for (const kind of ERROR_KINDS) {
                expect(cat[errorKindCauseKey(kind)], `${loc}:${kind}`).toBeTruthy();
                expect(cat[errorKindActionKey(kind)], `${loc}:${kind}`).toBeTruthy();
            }
        }
    });

    it("covers every error.* key used by the backend wire format", () => {
        const keys = new Set(ERROR_CATALOG.map((e) => e.key));
        for (const k of Object.keys(en)) {
            if (!k.startsWith("error.") || k.startsWith("error.entity.") || k === "error.boundary.body") continue;
            expect(keys.has(k), `${k} has no code — append it to error-catalog.ts`).toBe(true);
        }
    });
});

describe("resolveAppError", () => {
    it("gives backend free-text errors their own code and translation", () => {
        const info = resolveAppError("error.app.validation|detail=Duration must be between 5 and 720 minutes", "de");
        expect(info.entry.code).toMatch(/^MD-[A-Z]+-1\d\d$/);
        expect(info.message).toBe("Dauer muss zwischen 5 und 720 Minuten liegen.");
    });

    it("fills placeholders of translated templates", () => {
        const info = resolveAppError("error.app.validation|detail=Unknown status: FOO", "fr");
        expect(info.message).toBe("Statut inconnu : FOO");
    });

    it("translates not-found entities and disabled features", () => {
        expect(resolveAppError("error.app.not_found|resource=error.entity.patient", "de").message).toBe("Patient nicht gefunden.");
        const f = resolveAppError("FEATURE_DISABLED|feature=scanner", "en");
        expect(f.entry.origin).toBe("feature");
        expect(f.message).toContain("Scanner");
    });

    it("resolves coded tokens with params and code", () => {
        const info = resolveAppError("error.app.rate_limited|seconds=30", "en");
        expect(info.entry.code).toBe("MD-APP-008");
        expect(info.message).toContain("30");
    });

    it("hides database driver text behind a reference", () => {
        const info = resolveAppError("error.app.database|ref=AB12CD34", "en");
        expect(info.entry.kind).toBe("system");
        expect(info.message).toContain("AB12CD34");
        expect(info.ref).toBe("AB12CD34");
    });

    it("classifies uncoded network failures", () => {
        expect(resolveAppError(new TypeError("Failed to fetch"), "en").entry.key).toBe("error.app.network");
        expect(resolveAppError("error.app.timeout", "de").entry.retryable).toBe(true);
    });

    it("unwraps LAN-wrapped tokens", () => {
        expect(resolveAppError("LAN HTTP 400: error.payment.amount_invalid", "en").entry.key).toBe("error.payment.amount_invalid");
    });
});
