import {
    type ChangeEvent,
    type CSSProperties,
    type InputHTMLAttributes,
    type MutableRefObject,
    type SelectHTMLAttributes,
    type TextareaHTMLAttributes,
    forwardRef,
    useCallback,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { useDismissibleLayer } from "./use-dismissible-layer";

/* ── Text Input ── */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, hint, error, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
        const genId = useId();
        const inputId = id ?? genId;
        const errorId = `${inputId}-error`;
        const hintId = hint ? `${inputId}-hint` : undefined;
        const describedBy = [error ? errorId : null, hint ? hintId : null, ariaDescribedBy]
            .filter(Boolean)
            .join(" ") || undefined;

        return (
            <div className={error ? "ui-field-wrap input-wrap--error" : "ui-field-wrap"}>
                {label && (
                    <label htmlFor={inputId} className="ui-field-label">
                        {label}
                    </label>
                )}
                {hint ? (
                    <p id={hintId} className="ui-field-hint">
                        {hint}
                    </p>
                ) : null}
                <input
                    ref={ref}
                    id={inputId}
                    className={["input-edit", error ? "ui-field-error" : "", className].filter(Boolean).join(" ")}
                    {...props}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                />
                {error && (
                    <p id={errorId} className="ui-field-error-msg">
                        {error}
                    </p>
                )}
            </div>
        );
    },
);
Input.displayName = "Input";

/* ── Select ── */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    hint?: string;
    error?: string;
    options: { value: string; label: string }[];
    /** Render dropdown in a body portal (tables / overflow containers). */
    menuPortal?: boolean;
    menuClassName?: string;
}

function SelectMenu({
    selectId,
    options,
    selectedValue,
    className,
    style,
    onChoose,
}: {
    selectId: string;
    options: { value: string; label: string }[];
    selectedValue: string;
    className?: string;
    style?: CSSProperties;
    onChoose: (value: string) => void;
}) {
    return (
        <div
            className={["select-menu", className].filter(Boolean).join(" ")}
            style={style}
            role="listbox"
            aria-labelledby={selectId}
        >
            {options.map((o) => {
                const active = o.value === selectedValue;
                return (
                    <button
                        key={o.value}
                        type="button"
                        className={`select-option ${active ? "active" : ""}`}
                        role="option"
                        aria-selected={active}
                        onClick={() => onChoose(o.value)}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    (
        {
            className,
            label,
            hint,
            error,
            id,
            options,
            menuPortal = true,
            menuClassName,
            "aria-describedby": ariaDescribedBy,
            ...props
        },
        ref,
    ) => {
        const genId = useId();
        const selectId = id ?? genId;
        const errorId = `${selectId}-error`;
        const hintId = hint ? `${selectId}-hint` : undefined;
        const describedBy = [error ? errorId : null, hint ? hintId : null, ariaDescribedBy]
            .filter(Boolean)
            .join(" ") || undefined;

        const [open, setOpen] = useState(false);
        const rootRef = useRef<HTMLDivElement>(null);
        const triggerRef = useRef<HTMLButtonElement>(null);
        const menuPortalRef = useRef<HTMLDivElement>(null);
        const innerSelectRef = useRef<HTMLSelectElement | null>(null);
        const [portalMenuStyle, setPortalMenuStyle] = useState<CSSProperties | undefined>();

        const setSelectRef = useCallback(
            (el: HTMLSelectElement | null) => {
                innerSelectRef.current = el;
                if (typeof ref === "function") ref(el);
                else if (ref) (ref as MutableRefObject<HTMLSelectElement | null>).current = el;
            },
            [ref],
        );

        useDismissibleLayer({
            open,
            rootRef,
            containRefs: menuPortal ? [menuPortalRef] : undefined,
            onDismiss: () => setOpen(false),
        });

        const isControlled = props.value !== undefined;
        const [uncontrolledValue, setUncontrolledValue] = useState(() =>
            String(props.defaultValue ?? options[0]?.value ?? ""),
        );

        const selectedValue = useMemo(() => {
            if (isControlled) return String(props.value ?? "");
            const current = uncontrolledValue;
            if (current !== "") return current;
            return options[0]?.value ?? "";
        }, [isControlled, options, props.value, uncontrolledValue]);

        const selectedLabel =
            options.find((o) => o.value === selectedValue)?.label ?? options[0]?.label ?? "";

        useLayoutEffect(() => {
            if (!open || !menuPortal) {
                setPortalMenuStyle(undefined);
                return;
            }
            const update = () => {
                const trigger = triggerRef.current;
                if (!trigger) return;
                const rect = trigger.getBoundingClientRect();
                const viewportPad = 12;
                const maxWidth = Math.min(224, window.innerWidth - viewportPad * 2);
                const width = Math.max(rect.width, 160);
                let left = rect.left;
                if (left + width > window.innerWidth - viewportPad) {
                    left = window.innerWidth - viewportPad - width;
                }
                left = Math.max(viewportPad, left);
                setPortalMenuStyle({
                    position: "fixed",
                    top: rect.bottom + 6,
                    left,
                    width,
                    maxWidth,
                    zIndex: 10050,
                });
            };
            update();
            window.addEventListener("resize", update);
            window.addEventListener("scroll", update, true);
            return () => {
                window.removeEventListener("resize", update);
                window.removeEventListener("scroll", update, true);
            };
        }, [open, menuPortal, options.length, selectedValue]);

        const dispatchSyntheticChange = (nextValue: string) => {
            const sel = innerSelectRef.current;
            if (!sel) return;
            if (sel.value !== nextValue) {
                sel.value = nextValue;
            }
            sel.dispatchEvent(new Event("input", { bubbles: true }));
            sel.dispatchEvent(new Event("change", { bubbles: true }));
        };

        const chooseValue = (nextValue: string) => {
            if (props.disabled) return;
            if (!isControlled) {
                setUncontrolledValue(nextValue);
            }
            props.onChange?.({
                target: { value: nextValue, name: props.name ?? "" },
                currentTarget: { value: nextValue, name: props.name ?? "" },
            } as unknown as ChangeEvent<HTMLSelectElement>);
            dispatchSyntheticChange(nextValue);
            setOpen(false);
        };

        const onNativeChange = (e: ChangeEvent<HTMLSelectElement>) => {
            const next = e.target.value;
            if (!isControlled) {
                setUncontrolledValue(next);
            }
            props.onChange?.(e);
        };

        return (
            <div ref={rootRef} className={error ? "ui-field-wrap input-wrap--error" : "ui-field-wrap"}>
                {label && (
                    <label htmlFor={selectId} className="ui-field-label">
                        {label}
                    </label>
                )}
                {hint ? (
                    <p id={hintId} className="ui-field-hint">
                        {hint}
                    </p>
                ) : null}
                <div className={["select-wrap", open && menuPortal ? "select-wrap--menu-portal-open" : ""].filter(Boolean).join(" ")}>
                    <button
                        ref={triggerRef}
                        id={selectId}
                        type="button"
                        className={["input-edit", "select-edit", "select-trigger", error ? "ui-field-error" : "", className].filter(Boolean).join(" ")}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (props.disabled) return;
                            setOpen((v) => !v);
                        }}
                        disabled={props.disabled}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy || undefined}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                    >
                        <span className="select-trigger-label">{selectedLabel}</span>
                    </button>
                    <select
                        ref={setSelectRef}
                        value={selectedValue}
                        onChange={onNativeChange}
                        name={props.name}
                        required={props.required}
                        disabled={props.disabled}
                        tabIndex={-1}
                        aria-hidden
                        className="select-native-hidden"
                    >
                        {options.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    {open && !menuPortal ? (
                        <SelectMenu
                            selectId={selectId}
                            options={options}
                            selectedValue={selectedValue}
                            className={menuClassName}
                            onChoose={chooseValue}
                        />
                    ) : null}
                </div>
                {open && menuPortal && portalMenuStyle
                    ? createPortal(
                          <div ref={menuPortalRef}>
                              <SelectMenu
                                  selectId={selectId}
                                  options={options}
                                  selectedValue={selectedValue}
                                  className={["select-menu--portal", menuClassName].filter(Boolean).join(" ")}
                                  style={portalMenuStyle}
                                  onChoose={chooseValue}
                              />
                          </div>,
                          document.body,
                      )
                    : null}
                {error && (
                    <p id={errorId} className="ui-field-error-msg">
                        {error}
                    </p>
                )}
            </div>
        );
    },
);
Select.displayName = "Select";

/* ── Textarea ── */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, label, error, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
        const genId = useId();
        const taId = id ?? genId;
        const errorId = `${taId}-error`;
        const describedBy =
            error && ariaDescribedBy ? `${errorId} ${ariaDescribedBy}` : error ? errorId : ariaDescribedBy;

        return (
            <div className={error ? "ui-field-wrap input-wrap--error" : "ui-field-wrap"}>
                {label && (
                    <label htmlFor={taId} className="ui-field-label">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={taId}
                    className={["input-edit", error ? "ui-field-error" : "", className].filter(Boolean).join(" ")}
                    {...props}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy || undefined}
                />
                {error && (
                    <p id={errorId} className="ui-field-error-msg">
                        {error}
                    </p>
                )}
            </div>
        );
    },
);
Textarea.displayName = "Textarea";
