import { evaluatePasswordPolicy } from "@/lib/password-policy";

type Props = {
    password: string;
    idPrefix?: string;
};

/** Live checklist aligned with backend `validate_password_policy`. */
export function PasswordPolicyHints({ password, idPrefix = "pw-policy" }: Props) {
    const { rules } = evaluatePasswordPolicy(password);
    if (!password) {
        return (
            <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                Passwortrichtlinie: mindestens 12 Zeichen, Groß-/Kleinbuchstabe und Ziffer.
            </p>
        );
    }
    return (
        <ul
            id={`${idPrefix}-list`}
            style={{ margin: 0, paddingLeft: "1.1rem", fontSize: 12, lineHeight: 1.5 }}
            aria-live="polite"
        >
            {rules.map((r) => (
                <li
                    key={r.id}
                    style={{
                        color: r.met ? "var(--success)" : "var(--text-muted)",
                    }}
                >
                    {r.met ? "✓ " : "○ "}
                    {r.label}
                </li>
            ))}
        </ul>
    );
}
