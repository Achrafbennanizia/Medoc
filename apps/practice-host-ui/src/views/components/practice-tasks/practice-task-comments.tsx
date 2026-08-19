import { useCallback, useEffect, useMemo, useState } from "react";
import type { PracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import {
    addPracticeTaskComment,
    listPracticeTaskComments,
    type PracticeTaskComment,
} from "@/systems/practice-host/controllers/practice-task.controller";
import type { Staff } from "@/models/types";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { taskDrawerText } from "./task-workflow-ui";
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
    task: PracticeTask;
    staff: Staff[];
    active: boolean;
    canComment?: boolean;
};

function authorName(authorId: string, staff: Staff[], t: (key: string) => string): string {
    return staff.find((p) => p.id === authorId)?.name ?? t("breadcrumb.team");
}

function buildSystemEntries(
    task: PracticeTask,
    staff: Staff[],
    t: (key: string) => string,
): ThreadEntry[] {
    const entries: ThreadEntry[] = [];
    if (task.body?.trim()) {
        entries.push({
            id: `${task.id}-body`,
            authorLabel: authorName(task.created_by, staff, t),
            body: task.body.trim(),
            createdAt: task.created_at,
            kind: "system",
        });
    }
    if (task.done_note?.trim()) {
        entries.push({
            id: `${task.id}-done`,
            authorLabel: t("practice.tasks.done_note_label"),
            body: task.done_note.trim(),
            createdAt: task.updated_at,
            kind: "system",
        });
    }
    if (task.return_reason?.trim()) {
        entries.push({
            id: `${task.id}-return`,
            authorLabel: t("practice.tasks.return_reason_label"),
            body: task.return_reason.trim(),
            createdAt: task.updated_at,
            kind: "system",
        });
    }
    return entries;
}

export function PracticeTaskComments({ task, staff, active, canComment = true }: Props) {
    const t = useT();
    const tx = (key: string) => taskDrawerText(t, key);
    const toast = useToastStore((s) => s.add);
    const [comments, setComments] = useState<PracticeTaskComment[]>([]);
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
            const rows = await listPracticeTaskComments(task.id);
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
    }, [task.id, canComment, toast]);

    useEffect(() => {
        if (!active) return;
        void load();
    }, [load, active]);

    const thread = useMemo(() => {
        const system = buildSystemEntries(task, staff, t);
        const chat: ThreadEntry[] = comments.map((c) => ({
            id: c.id,
            authorLabel: authorName(c.author_id, staff, t),
            body: c.body,
            createdAt: c.created_at,
            kind: "comment" as const,
        }));
        return [...system, ...chat].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
    }, [task, comments, staff, t]);

    const send = async () => {
        const text = draft.trim();
        if (!text || busy || !canComment) return;
        setBusy(true);
        try {
            const created = await addPracticeTaskComment(task.id, text);
            setComments((prev) => [...prev, created]);
            setDraft("");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="practice-task-comments">
            <div className="appointment-drawer-eyebrow">{tx("page.practice_tickets.comments_title")}</div>
            <div className="practice-task-comments_thread" aria-live="polite">
                {loading ? (
                    <p className="practice-task-comments_empty">{tx("page.practice_tickets.comments_loading")}</p>
                ) : thread.length === 0 ? (
                    <p className="practice-task-comments_empty">{tx("page.practice_tickets.comments_empty")}</p>
                ) : (
                    thread.map((entry) => (
                        <article
                            key={entry.id}
                            className={`practice-task-comment ${entry.kind === "system" ? "practice-task-comment--system" : ""}`}
                        >
                            <div className="practice-task-comment_head">
                                <span className="practice-task-comment_author">{entry.authorLabel}</span>
                                <time className="practice-task-comment_time" dateTime={entry.createdAt}>
                                    {formatDateTime(entry.createdAt)}
                                </time>
                            </div>
                            <p className="practice-task-comment_body">{entry.body}</p>
                        </article>
                    ))
                )}
            </div>
            {canComment ? (
                <div className="practice-task-comments_compose">
                    <Textarea
                        label={tx("page.practice_tickets.comment_label")}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={tx("page.practice_tickets.comment_placeholder")}
                        rows={3}
                    />
                    <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={() => void send()}>
                        {tx("page.practice_tickets.comment_send")}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
