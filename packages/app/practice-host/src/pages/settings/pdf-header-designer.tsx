import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import {
    DOCTOR_HEADER_FIELDS,
    DOCUMENT_HEADER_LAYOUT_KV_KEY,
    HEADER_TABLE_COLUMNS,
    clearHeaderCell,
    defaultHeaderTable,
    firstEmptyHeaderCell,
    headerFieldAllowed,
    practiceCountry,
    headerTableJson,
    headerTableRowCount,
    parseHeaderTable,
    placeHeaderField,
    PRACTICE_HEADER_FIELDS,
    tableHasField,
    type HeaderTable,
} from "@/lib/document-header-layout";
import { practiceFieldLabel } from "@/lib/document-template-i18n";
import type { PracticeFieldKey } from "@/lib/document-template-schema";
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { deleteAppKv, getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import { useToastStore } from "@/views/components/ui/toast-store";
import { FIELD_MIME, dragToken, headerKind, fieldPreview, sameTable, readDrag } from "./pdf-header-designer-fields";

export function PdfHeaderDesigner() {
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const [table, setTable] = useState<HeaderTable | null>(null);
    const [practice, setPractice] = useState<Record<string, unknown> | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoPlacement, setLogoPlacement] = useState<"top" | "side">("side");
    const [over, setOver] = useState(false);
    const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
    const [draggingId, setDraggingId] = useState<PracticeFieldKey | null>(null);
    const dragged = useRef(false);
    const tableRef = useRef(table);
    const dragId = useRef<PracticeFieldKey | null>(null);
    const payload = useRef<{ kind: "field"; id: PracticeFieldKey } | { kind: "cell"; row: number; col: number } | null>(null);
    const snapshot = useRef<HeaderTable | null>(null);
    const committed = useRef(false);
    const positions = useRef(new Map<string, DOMRect>());
    const gridRef = useRef<HTMLDivElement>(null);
    tableRef.current = table;
    const country = practiceCountry(practice);
    const practiceFields = PRACTICE_HEADER_FIELDS.filter((id) => headerFieldAllowed(id, country));
    const doctorFields = DOCTOR_HEADER_FIELDS.filter((id) => headerFieldAllowed(id, country));

    useEffect(() => {
        let cancel = false;
        void (async () => {
            let loaded: Record<string, unknown> | null = null;
            try {
                const raw = await getAppKv("invoice.practice.v1");
                const parsed: unknown = raw ? JSON.parse(raw) : null;
                if (parsed && typeof parsed === "object") loaded = parsed as Record<string, unknown>;
            } catch {
                /* no practice yet: German default, as before */
            }
            if (cancel) return;
            setPractice(loaded);
            const c = practiceCountry(loaded);
            let saved: HeaderTable | null = null;
            try {
                saved = parseHeaderTable(await getAppKv(DOCUMENT_HEADER_LAYOUT_KV_KEY));
            } catch {
                saved = null;
            }
            if (cancel) return;
            // A saved table may still hold another country's ids (e.g. BSNR after switching to Morocco):
            // the PDF skips them, so the designer does too.
            const shown = saved?.map((row) => row.map((cell) => (cell && headerFieldAllowed(cell, c) ? cell : null)));
            setTable(shown && tableHasField(shown) ? shown : defaultHeaderTable(c));
        })();
        void getAppKv("practice.logo.v1")
            .then((raw) => {
                if (cancel || !raw) return;
                const parsed = JSON.parse(raw) as {
                    mime?: string;
                    data?: string;
                    showOnDocuments?: boolean;
                    placement?: string;
                };
                setLogoPlacement(parsed.placement === "top" ? "top" : "side");
                if (parsed.showOnDocuments === false || !parsed.mime || !parsed.data) return;
                setLogoUrl(`data:${parsed.mime};base64,${parsed.data}`);
            })
            .catch(() => undefined);
        return () => {
            cancel = true;
        };
    }, []);

    useLayoutEffect(() => {
        const nodes = gridRef.current?.querySelectorAll<HTMLElement>("[data-field]");
        if (!nodes) return;
        nodes.forEach((node) => {
            const id = node.dataset.field;
            if (!id) return;
            const next = node.getBoundingClientRect();
            const prev = positions.current.get(id);
            if (prev) {
                const dx = prev.left - next.left;
                const dy = prev.top - next.top;
                if (dx !== 0 || dy !== 0) {
                    node.animate(
                        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
                        { duration: 160, easing: "ease" },
                    );
                }
            }
            positions.current.set(id, next);
        });
    }, [table]);

    async function persist(next: HeaderTable) {
        const previous = table;
        setTable(next);
        try {
            await setAppKv(DOCUMENT_HEADER_LAYOUT_KV_KEY, headerTableJson(next));
        } catch (error) {
            if (previous) setTable(previous);
            toast(errorMessage(error), "error");
        }
    }

    async function reset() {
        const previous = table;
        setTable(defaultHeaderTable(country));
        try {
            await deleteAppKv(DOCUMENT_HEADER_LAYOUT_KV_KEY);
        } catch (error) {
            if (previous) setTable(previous);
            toast(errorMessage(error), "error");
        }
    }

    function finishDrag(next: HeaderTable | null) {
        committed.current = true;
        setHoverCell(null);
        setDraggingId(null);
        if (!next) return;
        const start = snapshot.current;
        if (start && sameTable(start, next)) return;
        void persist(next);
    }

    function onPaletteDragStart(event: DragEvent, id: PracticeFieldKey) {
        dragged.current = true;
        dragId.current = id;
        payload.current = { kind: "field", id };
        snapshot.current = table ? table.map((row) => [row[0], row[1]]) : null;
        committed.current = false;
        event.dataTransfer.setData(FIELD_MIME, dragToken("field", id));
        event.dataTransfer.effectAllowed = "move";
    }

    function onBlockDragStart(event: DragEvent, id: PracticeFieldKey, row: number, col: number) {
        dragged.current = true;
        dragId.current = id;
        payload.current = { kind: "cell", row, col };
        setDraggingId(id);
        snapshot.current = table ? table.map((cells) => [cells[0], cells[1]]) : null;
        committed.current = false;
        event.dataTransfer.setData(FIELD_MIME, dragToken("cell", `${row},${col}`));
        event.dataTransfer.effectAllowed = "move";
    }

    function onDragEnd() {
        // Drop is dispatched after dragend in this web view. Revert only if
        // that drop never committed, and do it after the drop handler runs.
        window.setTimeout(() => {
            if (!committed.current && snapshot.current) {
                tableRef.current = snapshot.current;
                setTable(snapshot.current);
            }
            payload.current = null;
            dragId.current = null;
            snapshot.current = null;
            committed.current = false;
            setDraggingId(null);
            setHoverCell(null);
            setOver(false);
            dragged.current = false;
        }, 0);
    }

    function acceptDrag(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
    }

    function fieldBeingDragged(event: DragEvent): PracticeFieldKey | null {
        const current = tableRef.current;
        let drag = payload.current;
        if (!drag) {
            const raw = event.dataTransfer.getData(FIELD_MIME);
            const parsed = raw ? readDrag(raw) : null;
            if (parsed) drag = parsed;
        }
        if (!drag) return dragId.current;
        if (drag.kind === "field") return drag.id;
        return current?.[drag.row]?.[drag.col] ?? null;
    }

    function dropOnCell(event: DragEvent, row: number, col: number) {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        const current = tableRef.current;
        const id = fieldBeingDragged(event);
        if (!current || !id) {
            finishDrag(current);
            return;
        }
        finishDrag(placeHeaderField(current, id, row, col));
    }

    const placed = new Set((table ?? []).flat().filter((id): id is PracticeFieldKey => id != null));
    const shownRows = table ? headerTableRowCount(table) : 0;

    function addFromPalette(id: PracticeFieldKey) {
        if (dragged.current) {
            dragged.current = false;
            return;
        }
        if (!table || placed.has(id)) return;
        const cell = firstEmptyHeaderCell(table);
        if (!cell) return;
        void persist(placeHeaderField(table, id, cell.row, cell.col));
    }

    return (
        <section className="settings-subcard settings-subcard--segment-safe pdf-header-designer-card">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.system.header_designer_title")}</div>
                    <div className="card-sub">{t("settings.system.header_designer_hint")}</div>
                </div>
                <div className="card-head-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => void reset()}>
                        {t("settings.system.header_designer_reset")}
                    </button>
                </div>
            </div>
            <div className="pdf-header-designer">
                <div className="pdf-header-designer__col" aria-label={t("settings.system.header_designer_fields")}>
                    <div className="pdf-header-designer__label">{t("settings.system.header_designer_fields")}</div>
                    <div className="pdf-header-designer__group">{t("settings.system.header_designer_practice")}</div>
                    {practiceFields.map((id) => (
                        <button
                            key={id}
                            type="button"
                            className={
                                placed.has(id)
                                    ? "pdf-header-designer__chip pdf-header-designer__chip--used"
                                    : "pdf-header-designer__chip"
                            }
                            draggable
                            onDragStart={(event) => onPaletteDragStart(event, id)}
                            onDragEnd={onDragEnd}
                            onClick={() => addFromPalette(id)}
                        >
                            {practiceFieldLabel(t, id)}
                        </button>
                    ))}
                    <div className="pdf-header-designer__group">{t("settings.system.header_designer_doctor")}</div>
                    {doctorFields.map((id) => (
                        <button
                            key={id}
                            type="button"
                            className={
                                placed.has(id)
                                    ? "pdf-header-designer__chip pdf-header-designer__chip--used"
                                    : "pdf-header-designer__chip"
                            }
                            draggable
                            onDragStart={(event) => onPaletteDragStart(event, id)}
                            onDragEnd={onDragEnd}
                            onClick={() => addFromPalette(id)}
                        >
                            {practiceFieldLabel(t, id)}
                        </button>
                    ))}
                </div>
                <div
                    className={
                        over
                            ? "pdf-header-designer__canvas pdf-header-designer__canvas--over"
                            : "pdf-header-designer__canvas"
                    }
                    aria-label={t("settings.system.header_designer_canvas")}
                    onDragOver={(event) => {
                        acceptDrag(event);
                        setOver(true);
                    }}
                    onDragLeave={() => setOver(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setOver(false);
                        const current = tableRef.current;
                        const id = fieldBeingDragged(event);
                        if (!current || !id) {
                            finishDrag(current);
                            return;
                        }
                        const cell = firstEmptyHeaderCell(current);
                        finishDrag(cell ? placeHeaderField(current, id, cell.row, cell.col) : current);
                    }}
                >
                    <div className="pdf-header-designer__label">{t("settings.system.header_designer_canvas")}</div>
                    <div
                        className={
                            logoPlacement === "top"
                                ? "pdf-header-sheet pdf-header-sheet--logo-top"
                                : "pdf-header-sheet"
                        }
                    >
                        <div className="pdf-header-sheet__logo">
                            {logoUrl ? (
                                <img src={logoUrl} alt="" />
                            ) : (
                                <span>{t("settings.practice.logo")}</span>
                            )}
                        </div>
                        <div className="pdf-header-sheet__grid" ref={gridRef}>
                            {Array.from({ length: shownRows }, (_, row) => (
                                <div
                                    className="pdf-header-sheet__row"
                                    key={row}
                                    onDragOver={acceptDrag}
                                    onDrop={(event) => {
                                        const rect = event.currentTarget.getBoundingClientRect();
                                        const col = event.clientX - rect.left < rect.width / 2 ? 0 : 1;
                                        dropOnCell(event, row, col);
                                    }}
                                >
                                    {Array.from({ length: HEADER_TABLE_COLUMNS }, (_, col) => {
                                        const id = table?.[row]?.[col] ?? null;
                                        const label = id ? practiceFieldLabel(t, id) : "";
                                        const hovering = hoverCell?.row === row && hoverCell.col === col;
                                        const cell = (
                                            <div
                                                key={col}
                                                className={
                                                    hovering
                                                        ? "pdf-header-sheet__cell pdf-header-sheet__cell--over"
                                                        : "pdf-header-sheet__cell"
                                                }
                                                onDragOver={(event) => {
                                                    acceptDrag(event);
                                                    setHoverCell({ row, col });
                                                }}
                                                onDrop={(event) => dropOnCell(event, row, col)}
                                            >
                                                {id ? (
                                                    <div
                                                        data-field={id}
                                                        className={[
                                                            "pdf-header-sheet__block",
                                                            `pdf-header-sheet__block--${headerKind(id)}`,
                                                            draggingId === id ? "pdf-header-sheet__block--dragging" : "",
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" ")}
                                                        draggable
                                                        onDragStart={(event) => onBlockDragStart(event, id, row, col)}
                                                        onDragEnd={onDragEnd}
                                                        onDragOver={(event) => {
                                                            acceptDrag(event);
                                                            setHoverCell({ row, col });
                                                        }}
                                                        onDrop={(event) => dropOnCell(event, row, col)}
                                                    >
                                                        <span className="pdf-header-sheet__text">{fieldPreview(id, practice, label)}</span>
                                                        <button
                                                            type="button"
                                                            className="pdf-header-sheet__remove"
                                                            aria-label={`${t("settings.system.header_designer_remove")} ${label}`}
                                                            onMouseDown={(event: MouseEvent) => event.stopPropagation()}
                                                            onClick={() => {
                                                                if (!table) return;
                                                                const next = clearHeaderCell(table, row, col);
                                                                if (!tableHasField(next)) {
                                                                    void reset();
                                                                    return;
                                                                }
                                                                void persist(next);
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="pdf-header-sheet__placeholder">{t("settings.system.header_designer_empty")}</span>
                                                )}
                                            </div>
                                        );
                                        return col === 0 ? (
                                            cell
                                        ) : (
                                            <span className="pdf-header-sheet__pair" key={col}>
                                                <span className="pdf-header-sheet__dot" aria-hidden>·</span>
                                                {cell}
                                            </span>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
