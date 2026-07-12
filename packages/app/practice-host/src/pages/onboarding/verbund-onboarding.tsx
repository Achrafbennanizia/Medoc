import { Navigate } from "react-router-dom";

/** Legacy welcome route — activation is a single license step at `/onboarding`. */
export function VerbundOnboardingPage() {
    return <Navigate to="/onboarding/lizenz" replace />;
}
