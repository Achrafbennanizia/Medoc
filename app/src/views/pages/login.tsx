import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../controllers/auth.controller";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

function formatLoginError(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return "Anmeldung fehlgeschlagen";
    }
}

export function LoginPage() {
    const [email, setEmail] = useState("");
    const [passwort, setPasswort] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const sessionChecked = useAuthStore((s) => s.sessionChecked);

    useEffect(() => {
        if (sessionChecked && session) navigate("/", { replace: true });
    }, [sessionChecked, session, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, passwort);
            navigate("/");
        } catch (err) {
            setError(formatLoginError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-dim">
            <div className="glass-bright rounded-2xl p-8 w-full max-w-sm animate-scale-in">
                <div className="text-center mb-8">
                    <h1 className="text-display text-primary">MeDoc</h1>
                    <p className="text-body text-on-surface-variant mt-1">Zahnarztpraxis Management</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div role="alert" className="bg-error-container text-error px-4 py-3 rounded-lg text-body">
                            {error}
                        </div>
                    )}

                    <Input
                        id="email"
                        type="email"
                        label="E-Mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ahmed@praxis.de"
                        required
                    />

                    <Input
                        id="passwort"
                        type="password"
                        label="Passwort"
                        value={passwort}
                        onChange={(e) => setPasswort(e.target.value)}
                        placeholder="••••••••"
                        required
                    />

                    <Button type="submit" loading={loading} className="w-full">
                        Anmelden
                    </Button>
                </form>

                {import.meta.env.DEV && (
                    <p className="mt-6 text-center text-caption text-on-surface-variant">
                        Demo: ahmed@praxis.de / passwort123
                    </p>
                )}
            </div>
        </div>
    );
}
