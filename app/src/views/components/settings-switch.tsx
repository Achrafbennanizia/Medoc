export function SettingsSwitch({
    checked,
    onChange,
    ariaLabel,
    disabled,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            className={`settings-switch${checked ? " settings-switch--on" : ""}`}
            onClick={() => {
                if (disabled) return;
                onChange(!checked);
            }}
        >
            <span className="settings-switch__thumb" aria-hidden />
        </button>
    );
}
