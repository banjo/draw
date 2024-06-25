import { Result, wrapAsync } from "@banjoanton/utils";
import { prisma } from "db";
import { OauthProvider } from "../auth/providers";
import { createContextLogger } from "../lib/context-logger";

const logger = createContextLogger("user-repository");

type CreateOauthUserProps = {
    provider: OauthProvider;
    providerUserId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
};

const createOauthUser = async (props: CreateOauthUserProps) => {
    const { provider, providerUserId, email, name, avatarUrl } = props;
    logger.info({ provider, providerUserId, email }, "Creating oauth user");

    const [user, error] = await wrapAsync(async () =>
        prisma.user.create({
            data: {
                email,
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
        logger.error({ error, provider, providerUserId, email }, "Error creating oauth user");
        return Result.error("Error creating oauth user", "InternalError");
    }

    logger.info({ provider, providerUserId, email }, "Successfully created oauth user");

    return Result.ok(user);
};

const getOauthByProvider = async (provider: OauthProvider, providerUserId: string) => {
    logger.trace({ provider, providerUserId }, "Getting user by oauth provider");

    const [oauth, error] = await wrapAsync(async () =>
        prisma.oauthAccount.findFirst({
            where: {
                provider,
                providerUserId,
            },
        })
    );

    if (error) {
        logger.error({ error, provider, providerUserId }, "Error getting user by oauth provider");
        return Result.error("Error getting user by oauth provider", "InternalError");
    }

    if (oauth) {
        logger.trace({ provider, providerUserId }, "Successfully got user by oauth provider");
    }

    return Result.ok(oauth);
};

const getUserByEmail = async (email: string) => {
    logger.trace({ email }, "Getting user by email");

    const [user, error] = await wrapAsync(async () =>
        prisma.user.findFirst({
            where: {
                email,
            },
        })
    );

    if (error) {
        logger.error({ error, email }, "Error getting user by email");
        return Result.error("Error getting user by email", "InternalError");
    }

    if (user) {
        logger.trace({ email }, "Successfully got user by email");
    } else {
        logger.trace({ email }, "No user found by email");
    }

    return Result.ok(user);
};

const addOauthAccount = async (
    userId: number,
    { provider, avatarUrl, providerUserId, name }: Omit<CreateOauthUserProps, "email">
) => {
    logger.info({ provider, providerUserId }, "Adding oauth account");

    const [oauth, error] = await wrapAsync(async () =>
        prisma.oauthAccount.create({
            data: {
                provider,
                providerUserId,
                name,
                avatarUrl,
                userId,
            },
        })
    );

    if (error) {
        logger.error({ error, provider, providerUserId }, "Error adding oauth account");
        return Result.error("Error adding oauth account", "InternalError");
    }

    logger.info({ provider, providerUserId }, "Successfully added oauth account");
    return Result.ok(oauth);
};

export const AuthRepository = {
    createOauthUser,
    getOauthByProvider,
    getUserByEmail,
    addOauthAccount,
};
