import { useT, useTParams, translateLocale } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type { ExportPreviewPayload } from "@/models/store/export-preview-store";
import { parseDelimitedGrid, sortGridRows, stringifyDelimitedGrid } from "@/lib/export-delimited";
import { printHtmlDocument } from "@/lib/print-html";
import { saveOrDownloadBytes, saveOrDownloadText } from "@/lib/save-download";
import { useToastStore } from "./ui/toast-store";

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatLabel(format: ExportPreviewPayload["format"], t: (key: string) => string): string {
    switch (format) {
        case "csv":
            return t("common.format_csv_table");
        case "html":
            return t("common.format_html");
        case "json":
            return t("common.format_json");
        case "xml":
            return t("common.format_xml");
        case "pdf":
            return t("common.format_pdf");
        case "zip":
            return t("common.format_zip");
        default:
            return format;
    }
}

function buildPrintHtmlTable(rows: string[][]): string {
    if (rows.length === 0) return `<p>${translateLocale("de", "common.no_data")}</p>`;
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
<div class="meta">${escapeHtml(translateLocale("de", "export.preview.meta"))}</div>
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
    const t = useT();
    const tp = useTParams();
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
            case "html":
                return "text/html;charset=utf-8";
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
        if (payload.format === "html" && payload.textBody) {
            printHtmlDocument(payload.textBody);
            return;
        }
        if (payload.format === "pdf" && pdfUrl) {
            printPdfBlobInHiddenIframe(pdfUrl);
            return;
        }
        if (payload.format === "zip") {
            toast(t("common.zip_no_print"), "info");
            return;
        }
        toast(t("common.no_print_preview"), "info");
    };

    const handleSave = async () => {
        const name = fileName.trim() || payload.suggestedFilename;
        setSaveBusy(true);
        try {
            if (payload.format === "pdf" || payload.format === "zip") {
                if (!payload.binaryBody?.length) {
                    toast(t("common.no_file_data"), "error");
                    return;
                }
                const copy = new Uint8Array(payload.binaryBody.byteLength);
                copy.set(payload.binaryBody);
                const ok = await saveOrDownloadBytes(name, copy, mimeForSave());
                if (ok) toast(t("common.file_saved"), "success");
            } else {
                const text = currentTextForSave();
                if (!text) {
                    toast(t("common.no_content_to_save"), "error");
                    return;
                }
                const ok = await saveOrDownloadText(name, text, mimeForSave());
                if (ok) toast(t("common.file_saved"), "success");
            }
        } catch (e) {
            toast(tp("export.preview.save_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
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
                                            title={t("common.sort_column")}
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
                        {tp("common.no_data_rows", { count: body.length, n: body.length === 1 ? "" : "n" })}
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
        if (payload.format === "html" && payload.textBody) {
            return (
                <div className="export-preview-pdf-wrap export-preview-html-wrap">
                    <iframe title={t("export.preview.html_preview")} srcDoc={payload.textBody} className="export-preview-pdf-frame" />
                </div>
            );
        }
        if (payload.format === "pdf" && pdfUrl) {
            return (
                <div className="export-preview-pdf-wrap">
                    <iframe title={t("export.preview.pdf_preview")} src={pdfUrl} className="export-preview-pdf-frame" />
                </div>
            );
        }
        if (payload.format === "zip" && byteLen > 0) {
            return (
                <div className="card card-pad export-preview-zip">
                    <p className="text-body" style={{ margin: 0 }}>
                        {tp("export.preview.zip_hint", { size: byteLabel })}
                    </p>
                </div>
            );
        }
        return <p className="text-body text-on-surface-variant">{t("common.no_preview_available")}</p>;
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
                        {t("common.close")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={handlePrint}>
                        {t("common.print")}
                    </Button>
                    <Button type="button" onClick={() => void handleSave()} loading={saveBusy} disabled={saveBusy}>
                        {t("common.save_to_file")}
                    </Button>
                </>
            }
        >
            <div className="export-preview-dialog-inner col" style={{ gap: 14 }}>
                <div className="export-preview-badges row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="pill blue">{formatLabel(payload.format, t)}</span>
                    {payload.hint ? (
                        <span className="text-body text-on-surface-variant" style={{ fontSize: 13 }}>
                            {payload.hint}
                        </span>
                    ) : null}
                </div>
                <Input
                    id="export-filename"
                    label={t("export.picker.filename")}
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="input-edit"
                />
                {previewBody()}
            </div>
        </Dialog>
    );
}
