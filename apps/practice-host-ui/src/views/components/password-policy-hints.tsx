import { evaluatePasswordPolicy, passwordPolicyRuleKey } from "@/lib/password-policy";
import { useT } from "@/lib/i18n";

type Props = {
    password: string;
    idPrefix?: string;
};

/** Live checklist aligned with backend `validate_password_policy`. */
export function PasswordPolicyHints({ password, idPrefix = "pw-policy" }: Props) {
    const t = useT();
    const { rules } = evaluatePasswordPolicy(password);
    if (!password) {
        return (
            <p className="page-sub" style={{ margin: 0, fontSize: 12 }}>
                {t("auth.password_policy_hint")}
            </p>
        );
    }
    return (
        <ul
            id={`${idPrefix}-list`}
            style={{ margin: 0, paddingInlineStart: "1.1rem", fontSize: 12, lineHeight: 1.5 }}
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
                    {t(passwordPolicyRuleKey(r.id))}
                </li>
            ))}
        </ul>
    );
}
