/**
 * Right-hand part of a list / detail page while no row is selected: a short overview of the list
 * (a few key figures), what to do next, and the main action. Keeps the second part useful instead
 * of empty, so the layout never jumps when a row is selected.
 */
import type { ReactNode } from "react";
import { Card } from "../ui/card";

export type OverviewFact = { label: string; value: ReactNode; tone?: "warn" };

export function MasterDetailOverview({ title, facts, hint, action }: { title: string; facts: OverviewFact[]; hint: string; action?: ReactNode }) {
    return (
        <Card className="card-pad products-detail-card master-detail-overview">
            <h3 className="text-title">{title}</h3>
            <dl className="master-detail-overview__facts">
                {facts.map((f) => (
                    <div key={f.label} data-tone={f.tone}>
                        <dt>{f.label}</dt>
                        <dd>{f.value}</dd>
                    </div>
                ))}
            </dl>
            <p className="page-sub">{hint}</p>
            {action ? <div className="master-detail-overview__action">{action}</div> : null}
        </Card>
    );
}
