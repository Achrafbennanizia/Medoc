import { useNavigate } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { Button } from "@/views/components/ui/button";

export type EinstellungenMigrationSectionProps = {
    canMigration: boolean;
};

export function EinstellungenMigrationSection({ canMigration }: EinstellungenMigrationSectionProps) {
    const t = useT();
    const navigate = useNavigate();

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.migration.title")}</div>
                    <div className="card-sub">{t("settings.migration.subtitle")}</div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="card-sub" style={{ margin: 0 }}>
                    {t("settings.migration.body")}
                </p>
                {canMigration ? (
                    <Button type="button" onClick={() => navigate("/migration")}>
                        {t("settings.migration.go")}
                    </Button>
                ) : (
                    <p className="card-sub" style={{ margin: 0 }}>
                        {t("settings.migration.not_allowed")}
                    </p>
                )}
            </div>
        </section>
    );
}
