import { useCallback, useEffect, useMemo, useState } from "react";
import type { PraxisAufgabe } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import {
    addPraxisAufgabeKommentar,
    listPraxisAufgabeKommentare,
    type PraxisAufgabeKommentar,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import type { Personal } from "@/models/types";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { aufgabeDrawerText } from "./aufgabe-workflow-ui";
import { Button } from "../ui/button";
import { Textarea } from "../ui/input";
import { useToastStore } from "../ui/toast-store";

type ThreadEntry = {
    id: string;
    authorLabel: string;
    body: string;
    createdAt: string;
    kind: "comment" | "system";
};

type Props = {
    aufgabe: PraxisAufgabe;
    personal: Personal[];
    active: boolean;
    canComment?: boolean;
};

function authorName(authorId: string, personal: Personal[], t: (key: string) => string): string {
    return personal.find((p) => p.id === authorId)?.name ?? t("breadcrumb.team");
}

function buildSystemEntries(
    aufgabe: PraxisAufgabe,
    personal: Personal[],
    t: (key: string) => string,
): ThreadEntry[] {
    const entries: ThreadEntry[] = [];
    if (aufgabe.body?.trim()) {
        entries.push({
            id: `${aufgabe.id}-body`,
            authorLabel: authorName(aufgabe.created_by, personal, t),
            body: aufgabe.body.trim(),
            createdAt: aufgabe.created_at,
            kind: "system",
        });
    }
    if (aufgabe.erledigt_notiz?.trim()) {
        entries.push({
            id: `${aufgabe.id}-done`,
            authorLabel: t("praxis.aufgaben.done_note_label"),
            body: aufgabe.erledigt_notiz.trim(),
            createdAt: aufgabe.updated_at,
            kind: "system",
        });
    }
    if (aufgabe.zurueck_begruendung?.trim()) {
        entries.push({
            id: `${aufgabe.id}-return`,
            authorLabel: t("praxis.aufgaben.return_reason_label"),
            body: aufgabe.zurueck_begruendung.trim(),
            createdAt: aufgabe.updated_at,
            kind: "system",
        });
    }
    return entries;
}

export function PraxisAufgabeKommentare({ aufgabe, personal, active, canComment = true }: Props) {
    const t = useT();
    const tx = (key: string) => aufgabeDrawerText(t, key);
    const toast = useToastStore((s) => s.add);
    const [comments, setComments] = useState<PraxisAufgabeKommentar[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!canComment) {
            setComments([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const rows = await listPraxisAufgabeKommentare(aufgabe.id);
            setComments(rows);
        } catch (e) {
            const msg = errorMessage(e);
            if (!/not found/i.test(msg) && !/nicht autorisiert/i.test(msg) && !/unauthorized/i.test(msg)) {
                toast(msg, "error");
            }
            setComments([]);
        } finally {
            setLoading(false);
        }
    }, [aufgabe.id, canComment, toast]);

    useEffect(() => {
        if (!active) return;
        void load();
    }, [load, active]);

    const thread = useMemo(() => {
        const system = buildSystemEntries(aufgabe, personal, t);
        const chat: ThreadEntry[] = comments.map((c) => ({
            id: c.id,
            authorLabel: authorName(c.author_id, personal, t),
            body: c.body,
            createdAt: c.created_at,
            kind: "comment" as const,
        }));
        return [...system, ...chat].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
    }, [aufgabe, comments, personal, t]);

    const send = async () => {
        const text = draft.trim();
        if (!text || busy || !canComment) return;
        setBusy(true);
        try {
            const created = await addPraxisAufgabeKommentar(aufgabe.id, text);
            setComments((prev) => [...prev, created]);
            setDraft("");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="praxis-aufgabe-kommentare">
            <div className="termin-drawer-eyebrow">{tx("page.praxis_tickets.kommentare_title")}</div>
            <div className="praxis-aufgabe-kommentare__thread" aria-live="polite">
                {loading ? (
                    <p className="praxis-aufgabe-kommentare__empty">{tx("page.praxis_tickets.kommentare_loading")}</p>
                ) : thread.length === 0 ? (
                    <p className="praxis-aufgabe-kommentare__empty">{tx("page.praxis_tickets.kommentare_empty")}</p>
                ) : (
                    thread.map((entry) => (
                        <article
                            key={entry.id}
                            className={`praxis-aufgabe-kommentar ${entry.kind === "system" ? "praxis-aufgabe-kommentar--system" : ""}`}
                        >
                            <div className="praxis-aufgabe-kommentar__head">
                                <span className="praxis-aufgabe-kommentar__author">{entry.authorLabel}</span>
                                <time className="praxis-aufgabe-kommentar__time" dateTime={entry.createdAt}>
                                    {formatDateTime(entry.createdAt)}
                                </time>
                            </div>
                            <p className="praxis-aufgabe-kommentar__body">{entry.body}</p>
                        </article>
                    ))
                )}
            </div>
            {canComment ? (
                <div className="praxis-aufgabe-kommentare__compose">
                    <Textarea
                        label={tx("page.praxis_tickets.kommentar_label")}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={tx("page.praxis_tickets.kommentar_placeholder")}
                        rows={3}
                    />
                    <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={() => void send()}>
                        {tx("page.praxis_tickets.kommentar_send")}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
