import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export interface ReportPdfSummaryRow {
    label: string;
    value: string;
}

export interface ReportPdfSection {
    title: string;
    headers: string[];
    rows: string[][];
}

export interface ReportPdfInput {
    docTitle: string;
    generatedAt: string;
    practiceName: string;
    practiceAddress: string[];
    summary: ReportPdfSummaryRow[];
    sections: ReportPdfSection[];
}

/** Practice report PDF — same Rust renderer as record / discharge leaflet (`render_chart_blocks`). */
export async function renderReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
    const raw = await practiceSystem.invoke<number[]>("render_report_pdf_command", { input });
    return new Uint8Array(raw);
}
