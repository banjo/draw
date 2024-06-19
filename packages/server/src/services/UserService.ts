import { Result } from "@banjoanton/utils";
import { UserRepository } from "../repositories/UserRepository";
import { createContextLogger } from "../lib/context-logger";

const logger = createContextLogger("UserService");

type CreateUserProps = {
    externalId: string;
    email: string;
    name: string;
};

const createUser = async (props: CreateUserProps) => {
    const { externalId, email } = props;
    logger.info(
        { externalId, email },
        `Creating user with externalId: ${externalId} and email: ${email}`
    );

    const res = await UserRepository.createUser(props);

    if (!res.success) {
        logger.error(
            { externalId, email },
            `Could not create user with externalId: ${externalId} and email: ${email}`
        );
        return Result.error(
            `Could not create user with externalId: ${externalId} and email: ${email}`,
            "InternalError"
        );
    }

    logger.info(`Created user with externalId: ${externalId} and email: ${email}`);

    return Result.ok(res.data);
};

export const UserService = { createUser };
