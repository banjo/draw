import { Env } from "common";
import { Lucia } from "lucia";
import { OauthAccount, prisma } from "db";
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
        provider: attributes.provider,
        providerUserId: attributes.providerUserId,
    }),
});

type DatabaseUserAttributes = Pick<OauthAccount, "provider" | "providerUserId">;

declare module "lucia" {
    interface Register {
        Lucia: typeof lucia;
        UserId: number;
        DatabaseUserAttributes: DatabaseUserAttributes;
    }
}
