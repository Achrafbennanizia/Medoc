/** Mirrors `infrastructure/crypto/mod.rs` password policy (NFA-SEC). */

export type PasswordPolicyRuleId = "min_length" | "uppercase" | "lowercase" | "digit";

export type PasswordPolicyRule = {
    id: PasswordPolicyRuleId;
    met: boolean;
};

export type PasswordPolicyStatus = {
    valid: boolean;
    rules: PasswordPolicyRule[];
};

export function passwordPolicyRuleKey(id: PasswordPolicyRuleId): string {
    return `auth.password_policy.${id}`;
}

export function evaluatePasswordPolicy(password: string): PasswordPolicyStatus {
    const rules: PasswordPolicyRule[] = [
        {
            id: "min_length",
            met: [...password].length >= 12,
        },
        {
            id: "uppercase",
            met: /[A-Z]/.test(password),
        },
        {
            id: "lowercase",
            met: /[a-z]/.test(password),
        },
        {
            id: "digit",
            met: /\d/.test(password),
        },
    ];
    return { valid: rules.every((r) => r.met), rules };
}

export function passwordPolicyError(
    t: (key: string) => string,
    password: string,
): string | undefined {
    const { valid, rules } = evaluatePasswordPolicy(password);
    if (valid) return undefined;
    return rules
        .filter((r) => !r.met)
        .map((r) => t(passwordPolicyRuleKey(r.id)))
        .join("; ");
}
