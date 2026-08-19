import { Navigate } from "react-router-dom";

/** Legacy welcome route — activation is a single license step at `/onboarding`. */
export function ClusterOnboardingPage() {
    return <Navigate to="/onboarding/license" replace />;
}
