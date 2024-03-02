import { AsyncResultType, Result } from "@banjoanton/utils";
import { User, prisma } from "db";
import { createLogger } from "utils";

const logger = createLogger("UserRepository");

const getIdByExternalId = async (externalId: string): AsyncResultType<number> => {
    try {
        logger.trace(`Getting user by externalId: ${externalId}`);
        const user = await prisma.user.findUnique({
            where: {
                externalId,
            },
        });

        if (!user) {
            logger.error(`User not found with externalId: ${externalId}`);
            return Result.error("User not found", "NotFound");
        }

        logger.trace(`User found with externalId: ${externalId}`);
        return Result.ok(user.id);
    } catch (error) {
        logger.error(`Error getting user by externalId: ${externalId} - ${error}`);
        return Result.error("Error getting user", "InternalError");
    }
};

type CreateUserProps = {
    externalId: string;
    email: string;
    name: string;
};
const createUser = async ({ name, externalId, email }: CreateUserProps): AsyncResultType<User> => {
    try {
        logger.info(`Creating user: ${name}`);
        const user = await prisma.user.create({
            data: {
                externalId,
                email,
                name,
            },
        });

        return Result.ok(user);
    } catch (error) {
        logger.error(`Error creating user: ${name} - ${error}`);
        return Result.error("Error creating user", "InternalError");
    }
};

export const UserRepository = {
    getIdByExternalId,
    createUser,
};
