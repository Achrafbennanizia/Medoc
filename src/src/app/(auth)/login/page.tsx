"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [passwort, setPasswort] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const result = await signIn("credentials", {
            email,
            passwort,
            redirect: false,
        });

        setLoading(false);

        if (result?.error) {
            setError("Ungültige E-Mail oder Passwort.");
        } else {
            router.push("/");
            router.refresh();
        }
    }

    return (
        <div className="w-full max-w-md">
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-blue-600">MeDoc</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Praxismanagementsystem – Anmeldung
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            E-Mail
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="arzt@praxis.de"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="passwort"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Passwort
                        </label>
                        <input
                            id="passwort"
                            type="password"
                            required
                            value={passwort}
                            onChange={(e) => setPasswort(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? "Anmeldung läuft..." : "Anmelden"}
                    </button>
                </form>
            </div>
        </div>
    );
}
