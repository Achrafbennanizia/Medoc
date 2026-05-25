import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    countOpenPraxisAufgabenForMe,
    listPraxisAufgabenForMe,
    transitionPraxisAufgabe,
    type PraxisAufgabe,
    type PraxisAufgabeStatus,
} from "@/controllers/praxis-aufgabe.controller";
import { errorMessage, formatDateTime } from "@/lib/utils";
import { parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Input, Textarea } from "../components/ui/input";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";

import { POSTEINGANG_POLL_MS } from "@/lib/posteingang-config";

function statusVariant(status: PraxisAufgabeStatus): "default" | "primary" | "warning" | "success" {
    switch (status) {
        case "OFFEN":
        case "ZURUECK":
            return "warning";
        case "IN_BEARBEITUNG":
            return "primary";
        case "ERLEDIGT_REZEPTION":
            return "default";
        case "VALIDIERT":
            return "success";
        default:
            return "default";
    }
}

export function PosteingangPage() {
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const isArzt = role === "ARZT";
    const isRezeption = role === "REZEPTION";

    const [rows, setRows] = useState<PraxisAufgabe[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [notiz, setNotiz] = useState("");
    const [zurueckId, setZurueckId] = useState<string | null>(null);
    const [zurueckText, setZurueckText] = useState("");

    const load = useCallback(async () => {
        setErr(null);
        try {
            const list = await listPraxisAufgabenForMe();
            setRows(list);
            void countOpenPraxisAufgabenForMe().then((n) => {
                window.dispatchEvent(
                    new CustomEvent("medoc-nav-badges-refresh", { detail: { openAufgaben: n } }),
                );
            });
        } catch (e) {
            setErr(errorMessage(e));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        const id = window.setInterval(() => void load(), POSTEINGANG_POLL_MS);
        return () => window.clearInterval(id);
    }, [load]);

    const transition = async (
        id: string,
        status: PraxisAufgabeStatus,
        extra?: { erledigtNotiz?: string; zurueckBegruendung?: string },
    ) => {
        setBusyId(id);
        try {
            await transitionPraxisAufgabe({ id, status, ...extra });
            toast("Aufgabe aktualisiert", "success");
            setNotiz("");
            setZurueckId(null);
            setZurueckText("");
            await load();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="page-head">
                <div>
                    <h2 className="page-title">Posteingang</h2>
                    <p className="page-sub" style={{ marginTop: 4 }}>
                        {isRezeption
                            ? "Offene Aufgaben an die Rezeption — Aktualisierung alle 5 Sekunden (FA-AUFG-03)."
                            : isArzt
                              ? "Zugewiesene Aufgaben und erledigte Positionen zur Validierung (FA-AUFG-05)."
                              : "—"}
                    </p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                    Aktualisieren
                </Button>
            </div>

            {loading ? (
                <PageLoading label="Aufgaben werden geladen…" />
            ) : err ? (
                <PageLoadError message={err} onRetry={() => void load()} />
            ) : rows.length === 0 ? (
                <EmptyState icon="📥" title="Keine offenen Aufgaben" />
            ) : (
                <div className="col" style={{ gap: 12 }}>
                    {rows.map((a) => (
                        <div key={a.id} className="card" style={{ padding: 16 }}>
                            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                                <div className="col" style={{ gap: 4, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600 }}>{a.titel}</div>
                                    <div style={{ fontSize: 13, color: "var(--fg-3)" }}>
                                        {a.typ}
                                        {" · "}
                                        {formatDateTime(a.updated_at)}
                                    </div>
                                    {a.body ? (
                                        <p style={{ margin: "6px 0 0", fontSize: 14 }}>{a.body}</p>
                                    ) : null}
                                </div>
                                <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                            </div>
                            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                                <Link to={`/patienten/${a.patient_id}`}>
                                    <Button type="button" variant="secondary" size="sm">
                                        Patient öffnen
                                    </Button>
                                </Link>
                                {isRezeption && a.status === "OFFEN" ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={busyId === a.id}
                                        onClick={() => void transition(a.id, "IN_BEARBEITUNG")}
                                    >
                                        Übernehmen
                                    </Button>
                                ) : null}
                                {isRezeption
                                && (a.status === "IN_BEARBEITUNG" || a.status === "ZURUECK") ? (
                                    <>
                                        <Input
                                            label="Erledigt-Notiz"
                                            value={notiz}
                                            onChange={(e) => setNotiz(e.target.value)}
                                            placeholder="Kurznotiz oder Verweis"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={busyId === a.id}
                                            onClick={() =>
                                                void transition(a.id, "ERLEDIGT_REZEPTION", {
                                                    erledigtNotiz: notiz.trim() || undefined,
                                                })
                                            }
                                        >
                                            Erledigen
                                        </Button>
                                    </>
                                ) : null}
                                {isArzt && a.status === "ERLEDIGT_REZEPTION" ? (
                                    <>
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={busyId === a.id}
                                            onClick={() => void transition(a.id, "VALIDIERT")}
                                        >
                                            Validieren & schließen
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            disabled={busyId === a.id}
                                            onClick={() => setZurueckId(a.id)}
                                        >
                                            Zurück an Rezeption
                                        </Button>
                                    </>
                                ) : null}
                            </div>
                            {zurueckId === a.id ? (
                                <div className="col" style={{ gap: 8, marginTop: 12 }}>
                                    <Textarea
                                        label="Begründung *"
                                        value={zurueckText}
                                        onChange={(e) => setZurueckText(e.target.value)}
                                    />
                                    <div className="row" style={{ gap: 8 }}>
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={busyId === a.id || !zurueckText.trim()}
                                            onClick={() =>
                                                void transition(a.id, "ZURUECK", {
                                                    zurueckBegruendung: zurueckText.trim(),
                                                })
                                            }
                                        >
                                            Zurück senden
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setZurueckId(null);
                                                setZurueckText("");
                                            }}
                                        >
                                            Abbrechen
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
