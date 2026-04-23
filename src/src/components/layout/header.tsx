import { auth, signOut } from "@/lib/auth";
import { LogOut, User } from "lucide-react";

export async function Header() {
    const session = await auth();
    const user = session?.user;

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
            <div />
            <div className="flex items-center gap-4">
                {user && (
                    <>
                        <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{user.name}</span>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                {user.rolle}
                            </span>
                        </div>
                        <form
                            action={async () => {
                                "use server";
                                await signOut({ redirectTo: "/login" });
                            }}
                        >
                            <button
                                type="submit"
                                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                            >
                                <LogOut className="h-4 w-4" />
                                Abmelden
                            </button>
                        </form>
                    </>
                )}
            </div>
        </header>
    );
}
