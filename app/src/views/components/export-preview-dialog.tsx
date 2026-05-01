import { useEffect, useMemo, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { ExportPreviewPayload } from "@/models/store/export-preview-store";
import { parseDelimitedGrid, sortGridRows, stringifyDelimitedGrid } from "@/lib/export-delimited";
import { saveOrDownloadBytes, saveOrDownloadText } from "@/lib/save-download";
import { useToastStore } from "./ui/toast-store";

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatLabel(format: ExportPreviewPayload["format"]): string {
    switch (format) {
        case "csv":
            return "CSV (Tabelle)";
        case "json":
            return "JSON";
        case "xml":
            return "XML";
        case "pdf":
            return "PDF";
        case "zip":
            return "ZIP-Archiv";
        default:
            return format;
    }
}

function buildPrintHtmlTable(rows: string[][]): string {
    if (rows.length === 0) return "<p>Keine Daten.</p>";
    const [head, ...body] = rows;
    const th = (head ?? []).map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const trs = body
        .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
        .join("");
    return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

/**
 * Print without `window.open` (often blocked in WKWebView / Tauri). Uses a minimal hidden iframe.
 */
function printHtmlInHiddenIframe(title: string, innerHtml: string): void {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
        position: "fixed",
        right: "0",
        bottom: "0",
        width: "1px",
        height: "1px",
        border: "none",
        opacity: "0",
        pointerEvents: "none",
    });
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
        iframe.remove();
        return;
    }
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; color: #111; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 600; }
  pre { white-space: pre-wrap; font-size: 11px; font-family: ui-monospace, monospace; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">MeDoc · Export</div>
${innerHtml}
</body></html>`;
    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = (): void => {
        try {
            iframe.remove();
        } catch {
            /* ignore */
        }
    };

    const runPrint = (): void => {
        try {
            win.focus();
            win.print();
        } catch {
            cleanup();
        }
    };

    win.addEventListener("afterprint", cleanup, { once: true });
    requestAnimationFrame(() => {
        requestAnimationFrame(runPrint);
    });
}

/** PDF print via hidden iframe pointing at blob: URL (avoids pop-up blocker). */
function printPdfBlobInHiddenIframe(blobUrl: string): void {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
        position: "fixed",
        right: "0",
        bottom: "0",
        width: "1px",
        height: "1px",
        border: "none",
        opacity: "0",
        pointerEvents: "none",
    });
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    const cleanup = (): void => {
        try {
            iframe.remove();
        } catch {
            /* ignore */
        }
    };

    iframe.onload = (): void => {
        const win = iframe.contentWindow;
        if (!win) {
            cleanup();
            return;
        }
        win.addEventListener("afterprint", cleanup, { once: true });
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                try {
                    win.focus();
                    win.print();
                } catch {
                    cleanup();
                }
            });
        });
    };
}

export type ExportPreviewDialogProps = {
    payload: ExportPreviewPayload;
    onClose: () => void;
};

export function ExportPreviewDialog({ payload, onClose }: ExportPreviewDialogProps) {
    const toast = useToastStore((s) => s.add);
    const [fileName, setFileName] = useState(payload.suggestedFilename);
    const [saveBusy, setSaveBusy] = useState(false);
    const [sortCol, setSortCol] = useState<number | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        setFileName(payload.suggestedFilename);
        setSortCol(null);
        setSortDir("asc");
    }, [payload]);

    const parsedCsv = useMemo(() => {
        if (payload.format !== "csv" || !payload.textBody) {
            return { rows: [] as string[][], delimiter: ";" as const };
        }
        return parseDelimitedGrid(payload.textBody);
    }, [payload.format, payload.textBody]);

    const displayGrid = useMemo(() => {
        const { rows } = parsedCsv;
        if (rows.length === 0 || sortCol == null) return rows;
        return sortGridRows(rows, sortCol, sortDir);
    }, [parsedCsv, sortCol, sortDir]);

    useEffect(() => {
        if (payload.format !== "pdf" || !payload.binaryBody?.length) {
            setPdfUrl(null);
            return;
        }
        const copy = new Uint8Array(payload.binaryBody.byteLength);
        copy.set(payload.binaryBody);
        const url = URL.createObjectURL(new Blob([copy], { type: "application/pdf" }));
        setPdfUrl(url);
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [payload.format, payload.binaryBody]);

    const currentTextForSave = (): string => {
        if (payload.format === "csv" && displayGrid.length > 0) {
            return stringifyDelimitedGrid(displayGrid, parsedCsv.delimiter);
        }
        return payload.textBody ?? "";
    };

    const mimeForSave = (): string => {
        switch (payload.format) {
            case "csv":
                return "text/csv;charset=utf-8";
            case "json":
                return "application/json";
            case "xml":
                return "application/xml";
            case "pdf":
                return "application/pdf";
            case "zip":
                return "application/zip";
            default:
                return "application/octet-stream";
        }
    };

    const handleHeaderClick = (colIndex: number) => {
        if (sortCol === colIndex) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortCol(colIndex);
            setSortDir("asc");
        }
    };

    const handlePrint = () => {
        const title = payload.title;
        if (payload.format === "csv" && displayGrid.length > 0) {
            printHtmlInHiddenIframe(title, buildPrintHtmlTable(displayGrid));
            return;
        }
        if (payload.format === "json" && payload.textBody) {
            printHtmlInHiddenIframe(title, `<pre>${escapeHtml(payload.textBody)}</pre>`);
            return;
        }
        if (payload.format === "xml" && payload.textBody) {
            printHtmlInHiddenIframe(title, `<pre>${escapeHtml(payload.textBody)}</pre>`);
            return;
        }
        if (payload.format === "pdf" && pdfUrl) {
            printPdfBlobInHiddenIframe(pdfUrl);
            return;
        }
        if (payload.format === "zip") {
            toast("ZIP-Archive werden nicht gedruckt — bitte „In Datei speichern“ nutzen.", "info");
            return;
        }
        toast("Für diesen Export ist keine Druckvorschau verfügbar.", "info");
    };

    const handleSave = async () => {
        const name = fileName.trim() || payload.suggestedFilename;
        setSaveBusy(true);
        try {
            if (payload.format === "pdf" || payload.format === "zip") {
                if (!payload.binaryBody?.length) {
                    toast("Keine Dateidaten zum Speichern.", "error");
                    return;
                }
                const copy = new Uint8Array(payload.binaryBody.byteLength);
                copy.set(payload.binaryBody);
                const ok = await saveOrDownloadBytes(name, copy, mimeForSave());
                if (ok) toast("Datei gespeichert.", "success");
            } else {
                const text = currentTextForSave();
                if (!text) {
                    toast("Kein Inhalt zum Speichern.", "error");
                    return;
                }
                const ok = await saveOrDownloadText(name, text, mimeForSave());
                if (ok) toast("Datei gespeichert.", "success");
            }
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setSaveBusy(false);
        }
    };

    const byteLen = payload.binaryBody?.byteLength ?? 0;
    const byteLabel =
        byteLen >= 1024 * 1024
            ? `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
            : byteLen > 0
              ? `${(byteLen / 1024).toFixed(1)} KB`
              : "";

    const previewBody = () => {
        if (payload.format === "csv" && displayGrid.length > 0) {
            const headers = displayGrid[0] ?? [];
            const body = displayGrid.slice(1);
            return (
                <div className="export-preview-scroll">
                    <table className="tbl export-preview-tbl">
                        <thead>
                            <tr>
                                {headers.map((h, i) => (
                                    <th key={i}>
                                        <button
                                            type="button"
                                            className="export-preview-sort-btn"
                                            onClick={() => handleHeaderClick(i)}
                                            title="Spalte sortieren"
                                        >
                                            {h}
                                            {sortCol === i ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                                        </button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {body.map((row, ri) => (
                                <tr key={ri}>
                                    {row.map((c, ci) => (
                                        <td key={ci}>{c}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="export-preview-footnote text-caption text-on-surface-variant" style={{ margin: "10px 0 0" }}>
                        {body.length} Datenzeile{body.length === 1 ? "" : "n"} · Sortierung wirkt auf die gespeicherte Datei.
                    </p>
                </div>
            );
        }
        if (payload.format === "json" && payload.textBody) {
            return (
                <pre className="export-preview-pre card card-pad">{payload.textBody}</pre>
            );
        }
        if (payload.format === "xml" && payload.textBody) {
            return (
                <pre className="export-preview-pre card card-pad">{payload.textBody}</pre>
            );
        }
        if (payload.format === "pdf" && pdfUrl) {
            return (
                <div className="export-preview-pdf-wrap">
                    <iframe title="PDF-Vorschau" src={pdfUrl} className="export-preview-pdf-frame" />
                </div>
            );
        }
        if (payload.format === "zip" && byteLen > 0) {
            return (
                <div className="card card-pad export-preview-zip">
                    <p className="text-body" style={{ margin: 0 }}>
                        Archiv ({byteLabel}) — Vorschau nicht als Tabelle möglich. Speichern Sie die Datei und öffnen Sie sie
                        mit Ihrem Archivprogramm.
                    </p>
                </div>
            );
        }
        return <p className="text-body text-on-surface-variant">Keine Vorschau verfügbar.</p>;
    };

    return (
        <Dialog
            open
            onClose={onClose}
            title={payload.title}
            className="modal--export-preview"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Schließen
                    </Button>
                    <Button type="button" variant="secondary" onClick={handlePrint}>
                        Drucken
                    </Button>
                    <Button type="button" onClick={() => void handleSave()} loading={saveBusy} disabled={saveBusy}>
                        In Datei speichern…
                    </Button>
                </>
            }
        >
            <div className="export-preview-dialog-inner col" style={{ gap: 14 }}>
                <div className="export-preview-badges row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="pill blue">{formatLabel(payload.format)}</span>
                    {payload.hint ? (
                        <span className="text-body text-on-surface-variant" style={{ fontSize: 13 }}>
                            {payload.hint}
                        </span>
                    ) : null}
                </div>
                <Input
                    id="export-filename"
                    label="Dateiname"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="input-edit"
                />
                {previewBody()}
            </div>
        </Dialog>
    );
}
