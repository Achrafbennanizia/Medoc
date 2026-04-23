import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { Rolle } from "@/generated/prisma";

declare module "next-auth" {
    interface User {
        rolle: Rolle;
    }
    interface Session {
        user: {
            id: string;
            name: string;
            email: string;
            rolle: Rolle;
        };
    }
}

declare module "@auth/core/jwt" {
    interface JWT {
        id: string;
        rolle: Rolle;
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: "Anmeldedaten",
            credentials: {
                email: { label: "E-Mail", type: "email" },
                passwort: { label: "Passwort", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.passwort) return null;

                const user = await db.personal.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user) return null;

                const isValid = await bcrypt.compare(
                    credentials.passwort as string,
                    user.passwort
                );

                if (!isValid) return null;

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    rolle: user.rolle,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id!;
                token.rolle = user.rolle;
            }
            return token;
        },
        async session({ session, token }) {
            session.user.id = token.id;
            session.user.rolle = token.rolle;
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
});
