import { wrapAsync } from "@banjoanton/utils";
import { prisma } from "db";
import { OauthProvider } from "../auth/providers";
import { createContextLogger } from "../lib/context-logger";
import { Result } from "common";

const logger = createContextLogger("user-repository");

type OauthAccountProps = {
    provider: OauthProvider;
    providerUserId: string;
    name?: string;
    avatarUrl?: string;
};

type CreateOauthUserProps = OauthAccountProps & {
    email: string;
};

const createOauthUser = async (props: CreateOauthUserProps) => {
    const { provider, providerUserId, email, name, avatarUrl } = props;
    logger.info({ provider }, "Creating oauth user");

    const [user, error] = await wrapAsync(async () =>
        prisma.user.create({
            data: {
                email: email.toLowerCase(),
                name,
                avatarUrl,
                OauthAccount: {
                    create: {
                        provider,
                        providerUserId,
                        avatarUrl,
                        name,
                    },
                },
            },
        })
    );

    if (error) {
        logger.error({ error, provider }, "Error creating oauth user");
        return Result.error("Error creating oauth user");
    }

    logger.info({ provider, userId: user.id }, "Successfully created oauth user");
    return Result.ok(user);
};

const getOauthByProvider = async (provider: OauthProvider, providerUserId: string) => {
    logger.trace({ provider }, "Getting user by oauth provider");

    const [oauth, error] = await wrapAsync(async () =>
        prisma.oauthAccount.findFirst({
            where: {
                provider,
                providerUserId,
            },
        })
    );

    if (error) {
        logger.error({ error, provider }, "Error getting user by oauth provider");
        return Result.error("Error getting user by oauth provider");
    }

    return Result.ok(oauth);
};

/** Emails are compared without case, as older users may have mixed-case emails stored. */
const getUserByEmail = async (email: string) => {
    logger.trace("Getting user by email");

    const [user, error] = await wrapAsync(async () =>
        prisma.user.findFirst({
            where: {
                email: { equals: email, mode: "insensitive" },
            },
        })
    );

    if (error) {
        logger.error({ error }, "Error getting user by email");
        return Result.error("Error getting user by email");
    }

    return Result.ok(user);
};

/**
 * Link a provider account to a user, replacing the user's earlier account with the same
 * provider. That one has an outdated id, e.g. a Google id that was stored as a rounded number.
 */
const linkOauthAccount = async (
    userId: number,
    { provider, avatarUrl, providerUserId, name }: OauthAccountProps
) => {
    logger.info({ provider, userId }, "Linking oauth account");

    const [oauth, error] = await wrapAsync(async () =>
        prisma.$transaction(async tx => {
            await tx.oauthAccount.deleteMany({ where: { userId, provider } });
            return await tx.oauthAccount.create({
                data: { provider, providerUserId, name, avatarUrl, userId },
            });
        })
    );

    if (error) {
        logger.error({ error, provider, userId }, "Error linking oauth account");
        return Result.error("Error linking oauth account");
    }

    return Result.ok(oauth);
};

/** A user without a provider account, for the local sign-in. */
const getOrCreateUser = async ({ email, name }: { email: string; name?: string }) => {
    const [user, error] = await wrapAsync(async () =>
        prisma.user.upsert({
            where: { email },
            update: {},
            create: { email, name },
        })
    );

    if (error) {
        logger.error({ error }, "Error getting or creating user");
        return Result.error("Error getting or creating user");
    }

    return Result.ok(user);
};

export const AuthRepository = {
    createOauthUser,
    getOrCreateUser,
    getOauthByProvider,
    getUserByEmail,
    linkOauthAccount,
};
