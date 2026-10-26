import { Result } from "common";
import { AuthRepository } from "../../repositories/auth-repository";
import { OauthProvider } from "../providers";
import { OauthUserInfo } from "./user-info";

/**
 * The user to sign in for a provider account. A known provider account signs in as its user.
 * Otherwise the account is linked to the user with the same email, or a new user is created,
 * but only when the provider has verified the email. Without that, anyone could create a
 * provider account with someone else's email and take over their user.
 */
export const findOrCreateUser = async (oauthProvider: OauthProvider, oauthUser: OauthUserInfo) => {
    const account = await AuthRepository.getOauthByProvider(oauthProvider, oauthUser.id);
    if (!account.success) return Result.error("Could not sign in");
    if (account.data) return Result.ok(account.data.userId);

    if (!oauthUser.emailVerified) {
        return Result.error("The email isn't verified", { type: "Unauthorized" });
    }

    const accountProps = {
        provider: oauthProvider,
        providerUserId: oauthUser.id,
        avatarUrl: oauthUser.avatar_url,
        name: oauthUser.name,
    };

    const existingUser = await AuthRepository.getUserByEmail(oauthUser.email);
    if (!existingUser.success) return Result.error("Could not sign in");

    if (existingUser.data) {
        const linked = await AuthRepository.linkOauthAccount(existingUser.data.id, accountProps);
        return linked.success ? Result.ok(existingUser.data.id) : Result.error("Could not sign in");
    }

    const created = await AuthRepository.createOauthUser({
        ...accountProps,
        email: oauthUser.email,
    });
    return created.success ? Result.ok(created.data.id) : Result.error("Could not sign in");
};
