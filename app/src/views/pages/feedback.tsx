import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import {
    submitFeedback,
    type FeedbackKategorie,
} from "../../controllers/feedback.controller";

export function FeedbackPage() {
    const t = useT();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [category, setCategory] = useState<FeedbackKategorie>("feedback");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [ref, setRef] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function submit(e: FormEvent) {
        e.preventDefault();
        if (subject.trim().length < 3 || body.trim().length < 10) {
            toast(t("page.feedback.validation"), "error");
            return;
        }
        setSubmitting(true);
        try {
            await submitFeedback({
                kategorie: category,
                betreff: subject.trim(),
                nachricht: body.trim(),
                referenz: ref.trim() || null,
            });
            toast(t("page.feedback.toast_sent"), "success");
            setSubject("");
            setBody("");
            setRef("");
        } catch (err) {
            toast(`${t("page.feedback.toast_error")} ${errorMessage(err)}`, "error");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <header>
                <h1 className="page-title">{t("page.feedback.title")}</h1>
                <p style={{ color: "var(--fg-3)", fontSize: 14, maxWidth: 720, lineHeight: 1.55 }}>{t("page.feedback.banner")}</p>
            </header>

            <div role="status" className="card card-pad" style={{ background: "rgba(255,149,0,0.08)", borderColor: "rgba(255,149,0,0.25)" }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.5 }}>{t("page.feedback.notice_vigilance")}</p>
            </div>

            <Card>
                <div style={{ padding: 16, paddingTop: 14 }}>
                    <CardHeader title={t("page.feedback.form_title")} />
                    <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 560, marginTop: 8 }}>
                    <Select
                        label={t("page.feedback.field_category")}
                        value={category}
                        onChange={(e) => setCategory(e.target.value as FeedbackKategorie)}
                        options={[
                            { value: "feedback", label: t("page.feedback.cat.feedback") },
                            { value: "vigilance", label: t("page.feedback.cat.vigilance") },
                            { value: "technical", label: t("page.feedback.cat.technical") },
                        ]}
                    />
                    <Input label={t("page.feedback.field_subject")} value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} />
                    <Textarea
                        label={t("page.feedback.field_body")}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        style={{ minHeight: 120 }}
                        required
                        maxLength={4000}
                    />
                    <Input
                        label={t("page.feedback.field_ref")}
                        value={ref}
                        onChange={(e) => setRef(e.target.value)}
                        placeholder={t("page.feedback.field_ref_ph")}
                    />
                    <div className="row" style={{ gap: 10, marginTop: 12 }}>
                        <Button type="submit" disabled={submitting} loading={submitting}>{t("page.feedback.submit")}</Button>
                        <Button type="button" variant="ghost" onClick={() => navigate("/einstellungen?tab=hilfe")}>
                            {t("page.feedback.back_help")}
                        </Button>
                    </div>
                </form>
                </div>
            </Card>
        </div>
    );
}
