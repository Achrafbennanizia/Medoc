import { describe, expect, it } from "vitest";
import { evaluatePasswordPolicy, passwordPolicyError } from "./password-policy";

describe("evaluatePasswordPolicy", () => {
    it("rejects short or simple passwords", () => {
        expect(evaluatePasswordPolicy("Short1a").valid).toBe(false);
        expect(passwordPolicyError("onlylowercase12")).toBeTruthy();
    });

    it("accepts compliant passwords", () => {
        expect(evaluatePasswordPolicy("SecurePass42").valid).toBe(true);
        expect(passwordPolicyError("SecurePass42")).toBeUndefined();
    });
});
