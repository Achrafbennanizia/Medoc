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
                    dir={props.dir ?? (props.type === "tel" ? "ltr" : undefined)}
                    autoComplete={props.autoComplete ?? (props.type === "tel" ? "tel" : undefined)}
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
    /** Size the menu to the longest option instead of the trigger width. */
    menuFitContent?: boolean;
    /** Keep a fitted menu inside this ancestor (CSS selector). */
    menuContainSelector?: string;
}

const labelMeasureCanvas = typeof document === "undefined" ? null : document.createElement("canvas");

function measureLongestLabel(labels: string[], sample: HTMLElement): number {
    const cs = getComputedStyle(sample);
    const ctx = labelMeasureCanvas?.getContext("2d");
    if (!ctx) return sample.getBoundingClientRect().width;
    ctx.font = `400 13.5px ${cs.fontFamily}`.trim();
    let widest = 0;
    for (const label of labels) {
        widest = Math.max(widest, ctx.measureText(label).width);
    }
    return widest;
}

/** Cap / flip a portal menu so it stays inside the visible area (and scrolls inside). */
export function portalMenuVerticalPlacement(
    triggerRect: DOMRect,
    limitTop: number,
    limitBottom: number,
    preferredMaxHeight = 280,
): { top: number; maxHeight: number } {
    const gap = 6;
    const minUseful = 120;
    let top = triggerRect.bottom + gap;
    let maxHeight = Math.min(preferredMaxHeight, limitBottom - top);
    if (maxHeight < minUseful) {
        const above = triggerRect.top - gap - limitTop;
        if (above > maxHeight) {
            maxHeight = Math.min(preferredMaxHeight, above);
            top = Math.max(limitTop, triggerRect.top - gap - maxHeight);
        }
    }
    maxHeight = Math.max(minUseful, maxHeight);
    // Never paint past the bottom edge even if preferredMaxHeight is larger.
    maxHeight = Math.min(maxHeight, Math.max(minUseful, limitBottom - top));
    return { top, maxHeight };
}

function selectPortalMenuStyle(
    trigger: HTMLElement,
    fitContent = false,
    optionLabels: string[] = [],
    contain: HTMLElement | null = null,
): CSSProperties {
    const rect = trigger.getBoundingClientRect();
    const viewportPad = 8;
    const bounds = contain?.getBoundingClientRect();
    const limitLeft = Math.max(viewportPad, bounds ? bounds.left + viewportPad : viewportPad);
    const limitRight = Math.min(
        window.innerWidth - viewportPad,
        bounds ? bounds.right - viewportPad : window.innerWidth - viewportPad,
    );
    const limitTop = Math.max(viewportPad, bounds ? bounds.top + viewportPad : viewportPad);
    const limitBottom = Math.min(
        window.innerHeight - viewportPad,
        bounds ? bounds.bottom - viewportPad : window.innerHeight - viewportPad,
    );
    const maxWidth = Math.max(120, limitRight - limitLeft);
    const rtl = document.documentElement.dir === "rtl";
    const { top, maxHeight } = portalMenuVerticalPlacement(rect, limitTop, limitBottom, fitContent ? 360 : 280);
    if (fitContent) {
        const textWidth = measureLongestLabel(optionLabels, trigger);
        const width = Math.min(Math.max(Math.ceil(textWidth + 36), 120), maxWidth);
        let left = rtl ? rect.left : rect.right - width;
        if (left < limitLeft) left = limitLeft;
        if (left + width > limitRight) left = Math.max(limitLeft, limitRight - width);
        return {
            position: "fixed",
            top,
            left,
            right: "auto",
            width,
            minWidth: width,
            maxWidth: width,
            maxHeight,
            overflow: "auto",
            boxSizing: "border-box",
            zIndex: 10050,
        };
    }
    const width = Math.min(Math.max(rect.width, 160), maxWidth);
    if (rtl) {
        const right = Math.max(viewportPad, window.innerWidth - rect.right);
        return {
            position: "fixed",
            top,
            right,
            left: "auto",
            width,
            maxWidth: width,
            maxHeight,
            overflow: "auto",
            zIndex: 10050,
        };
    }
    let left = rect.left;
    if (left + width > window.innerWidth - viewportPad) {
        left = window.innerWidth - viewportPad - width;
    }
    left = Math.max(viewportPad, left);
    return {
        position: "fixed",
        top,
        left,
        right: "auto",
        width,
        maxWidth: width,
        maxHeight,
        overflow: "auto",
        zIndex: 10050,
    };
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
            menuFitContent = false,
            menuContainSelector,
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

        const measurePortalMenu = useCallback(() => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            const contain = menuContainSelector ? trigger.closest(menuContainSelector) : null;
            setPortalMenuStyle(
                selectPortalMenuStyle(
                    trigger,
                    menuFitContent,
                    options.map((o) => o.label),
                    contain instanceof HTMLElement ? contain : null,
                ),
            );
        }, [menuContainSelector, menuFitContent, options]);

        useLayoutEffect(() => {
            if (!open || !menuPortal) {
                setPortalMenuStyle(undefined);
                return;
            }
            measurePortalMenu();
            window.addEventListener("resize", measurePortalMenu);
            window.addEventListener("scroll", measurePortalMenu, true);
            return () => {
                window.removeEventListener("resize", measurePortalMenu);
                window.removeEventListener("scroll", measurePortalMenu, true);
            };
        }, [open, menuPortal, measurePortalMenu, selectedValue]);

        const chooseValue = (nextValue: string) => {
            if (props.disabled) return;
            if (!isControlled) {
                setUncontrolledValue(nextValue);
            }
            // Call onChange once with an explicit value. Do NOT also dispatch a
            // native change on the hidden <select> — that second event can report
            // the previous controlled value and reset filters (Practice tasks, etc.).
            props.onChange?.({
                target: { value: nextValue, name: props.name ?? "" },
                currentTarget: { value: nextValue, name: props.name ?? "" },
            } as unknown as ChangeEvent<HTMLSelectElement>);
            const sel = innerSelectRef.current;
            if (sel && sel.value !== nextValue) {
                sel.value = nextValue;
            }
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
                            setOpen((was) => {
                                const next = !was;
                                if (next && menuPortal) {
                                    // Measure immediately so the portal menu paints on the same open turn.
                                    void Promise.resolve().then(() => measurePortalMenu());
                                }
                                return next;
                            });
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
                {open && menuPortal
                    ? createPortal(
                          <div ref={menuPortalRef}>
                              <SelectMenu
                                  selectId={selectId}
                                  options={options}
                                  selectedValue={selectedValue}
                                  className={["select-menu--portal", menuClassName].filter(Boolean).join(" ")}
                                  style={
                                      portalMenuStyle ?? {
                                          position: "fixed",
                                          top: 0,
                                          left: 0,
                                          minWidth: 160,
                                          maxHeight: 280,
                                          overflow: "auto",
                                          zIndex: 10050,
                                          visibility: "hidden",
                                      }
                                  }
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
