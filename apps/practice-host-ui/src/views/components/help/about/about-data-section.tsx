/** Data & backups: database, audit trail, backups and the log folder. */
import { useT, useTParams } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import { formatBytes } from "./about-format";
import { AboutSection, Fact, Val } from "./about-primitives";
import { latestBackup, type AboutStatus } from "./about-status";

export function AboutDataSection({ status }: { status: AboutStatus }) {
    const t = useT();
    const tp = useTParams();
    return (
        <AboutSection id="data">
            <dl className="help-facts">
                <Fact label={t("help.about.database")}>
                    <Val v={status.health}>{(h) => (h.db_ok ? tp("help.about.data.db", { ms: h.db_latency_ms }) : t("help.about.data.db_fail"))}</Val>
                </Fact>
                <Fact label={t("help.about.audit_chain")}>
                    <Val v={status.health}>{(h) => (h.audit_chain_ok ? t("help.about.audit_ok") : tp("help.about.audit_broken", { at: h.audit_broken_at ?? "?" }))}</Val>
                </Fact>
                <Fact label={t("help.about.backups")}>
                    <Val v={status.backups}>
                        {(b) => {
                            const l = latestBackup(b);
                            if (!l) return t("help.about.data.no_backup");
                            return tp("help.about.backups_value", { count: b.length, when: formatDateTime(new Date(l.at).toISOString()), size: formatBytes(l.info.size_bytes) });
                        }}
                    </Val>
                </Fact>
                <Fact label={t("help.about.logs")}>
                    <Val v={status.logDir}>{(d) => <code className="about-path">{d}</code>}</Val>
                </Fact>
            </dl>
        </AboutSection>
    );
}
