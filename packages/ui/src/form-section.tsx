import type { ReactNode } from "react";

/** Wireframe-style grouped form block with a section title. */
export function FormSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
    return (
        <section className={["form-section", className].filter(Boolean).join(" ")}>
            <h3 className="form-section-title form-section-heading">{title}</h3>
            <div className="form-section-body">{children}</div>
        </section>
    );
}
