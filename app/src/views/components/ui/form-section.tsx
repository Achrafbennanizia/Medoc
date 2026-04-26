import type { ReactNode } from "react";

/** Wireframe-style grouped form block with a section title. */
export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
    return (
        <section className={["form-section", className].filter(Boolean).join(" ")}>
            <h3 className="form-section-title" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--fg-2)", margin: "0 0 14px" }}>
                {title}
            </h3>
            <div className="form-section-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {children}
            </div>
        </section>
    );
}
