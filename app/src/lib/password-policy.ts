/** Mirrors `infrastructure/crypto/mod.rs` password policy (NFA-SEC). */

export type PasswordPolicyRule = {
    id: string;
    label: string;
    met: boolean;
};

export type PasswordPolicyStatus = {
    valid: boolean;
    rules: PasswordPolicyRule[];
};

export function evaluatePasswordPolicy(password: string): PasswordPolicyStatus {
    const rules: PasswordPolicyRule[] = [
        {
            id: "min_length",
            label: "Mindestens 12 Zeichen",
            met: [...password].length >= 12,
        },
        {
            id: "uppercase",
            label: "Mindestens ein Großbuchstabe (A–Z)",
            met: /[A-Z]/.test(password),
        },
        {
            id: "lowercase",
            label: "Mindestens ein Kleinbuchstabe (a–z)",
            met: /[a-z]/.test(password),
        },
        {
            id: "digit",
            label: "Mindestens eine Ziffer (0–9)",
            met: /\d/.test(password),
        },
    ];
    return { valid: rules.every((r) => r.met), rules };
}

export function passwordPolicyError(password: string): string | undefined {
    const { valid, rules } = evaluatePasswordPolicy(password);
    if (valid) return undefined;
    return rules
        .filter((r) => !r.met)
        .map((r) => r.label)
        .join("; ");
}
