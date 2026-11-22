/** Building blocks shared by the About & support sections. */
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { TONE_PILL } from "./about-format";
import type { Loaded, Tone } from "./about-status";
import { aboutSectionDomId, type AboutSectionId } from "./about-sections";

export type { AboutSectionId };


/** One section card with its heading; the id and data attribute drive the sub-navigation. */
export function AboutSection({ id, intro, children }: { id: AboutSectionId; intro?: ReactNode; children: ReactNode }) {
    const t = useT();
    return (
        <section id={aboutSectionDomId(id)} data-about-section={id} className="about-section" aria-labelledby={`${aboutSectionDomId(id)}-title`}>
            <header className="about-section__head">
                <h2 id={`${aboutSectionDomId(id)}-title`}>{t(`help.about.section.${id}`)}</h2>
                {intro ? <p className="about-muted">{intro}</p> : null}
            </header>
            {children}
        </section>
    );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

/** Renders a loaded value, or the right placeholder for loading / no permission / failure. */
export function Val<T>({ v, children }: { v: Loaded<T>; children: (value: T) => ReactNode }) {
    const t = useT();
    if (v.state === "loading") return <span className="about-muted">{t("help.about.loading")}</span>;
    if (v.state === "denied") return <span className="about-muted">{t("help.about.not_for_role")}</span>;
    if (v.state === "error") return <span className="about-muted" title={v.message}>{t("help.about.unavailable")}</span>;
    return <>{children(v.value)}</>;
}

export function StatusCard({ title, tone, summary, detail, action }: { title: string; tone: Tone; summary: ReactNode; detail?: ReactNode; action?: ReactNode }) {
    const t = useT();
    return (
        <section className="about-status-card" data-tone={tone}>
            <div className="about-status-card__head">
                <h3 className="about-status-card__title">{title}</h3>
                <span className={`pill ${TONE_PILL[tone]}`}>{t(`help.about.tone.${tone}`)}</span>
            </div>
            <div className="about-status-card__summary">{summary}</div>
            {detail ? <div className="about-status-card__detail">{detail}</div> : null}
            {action ? <div className="about-status-card__action">{action}</div> : null}
        </section>
    );
}
