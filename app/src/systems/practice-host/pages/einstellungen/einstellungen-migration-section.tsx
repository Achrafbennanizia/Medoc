import { useNavigate } from "react-router-dom";
import { Button } from "@/views/components/ui/button";

export type EinstellungenMigrationSectionProps = {
    canMigration: boolean;
};

export function EinstellungenMigrationSection({ canMigration }: EinstellungenMigrationSectionProps) {
    const navigate = useNavigate();

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">Migration</div>
                    <div className="card-sub">Datenimport aus Fremdsystemen</div>
                </div>
            </div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="card-sub" style={{ margin: 0 }}>
                    Assistent für strukturierte Datenübernahme — nur mit entsprechender Berechtigung.
                </p>
                {canMigration ? (
                    <Button type="button" onClick={() => navigate("/migration")}>
                        Zur Datenmigration
                    </Button>
                ) : (
                    <p className="card-sub" style={{ margin: 0 }}>
                        Für diese Rolle nicht freigeschaltet.
                    </p>
                )}
            </div>
        </section>
    );
}
