import { Link } from "react-router-dom";

export function VerbundOnboardingPage() {
    return (
        <div className="license-gate-page">
            <div className="license-gate-card">
                <h1>MeDoc einrichten</h1>
                <p className="card-sub">
                    Diese Installation ist noch keinem Praxis-Verbund zugeordnet. Wählen Sie, ob Sie
                    eine neue Praxis einrichten oder einem bestehenden Verbund beitreten.
                </p>
                <div className="license-gate-actions" style={{ display: "flex", gap: 12, flexDirection: "column" }}>
                    <Link to="/onboarding/lizenz" className="btn btn-accent">
                        Diese Praxis neu einrichten
                    </Link>
                    <Link to="/onboarding/beitreten" className="btn btn-subtle">
                        Diesem Praxis-Verbund beitreten
                    </Link>
                </div>
            </div>
        </div>
    );
}
