import { Env } from "common";
import { Lucia } from "lucia";
import { prisma } from "db";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";

const adapter = new PrismaAdapter(prisma.session, prisma.user);
const env = Env.server();

export const lucia = new Lucia(adapter, {
    sessionCookie: {
        attributes: {
            secure: env.NODE_ENV === "production",
        },
    },
    getUserAttributes: attributes => ({
        githubId: attributes.github_id,
        githubUsername: attributes.github_username,
    }),
});

type DatabaseUserAttributes = {
    github_id: number;
    github_username: string;
};

declare module "lucia" {
    interface Register {
        Lucia: typeof lucia;
        UserId: number;
        DatabaseUserAttributes: DatabaseUserAttributes;
    }
}
