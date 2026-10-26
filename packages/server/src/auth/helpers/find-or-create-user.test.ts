import { Result } from "common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRepository } from "../../repositories/auth-repository";
import { OauthProvider } from "../providers";
import { findOrCreateUser } from "./find-or-create-user";
import { OauthUserInfo } from "./user-info";

vi.mock("../../repositories/auth-repository", () => ({
    AuthRepository: {
        getOauthByProvider: vi.fn(),
        getUserByEmail: vi.fn(),
        linkOauthAccount: vi.fn(),
        createOauthUser: vi.fn(),
    },
}));

const repo = vi.mocked(AuthRepository);

const googleUser = (props: Partial<OauthUserInfo> = {}): OauthUserInfo => ({
    id: "112233445566778899001",
    email: "anna@example.com",
    emailVerified: true,
    name: "Anna",
    ...props,
});

const existingUser = { id: 7 } as never;

beforeEach(() => {
    vi.resetAllMocks();
    repo.getOauthByProvider.mockResolvedValue(Result.ok(null));
    repo.getUserByEmail.mockResolvedValue(Result.ok(null));
    repo.linkOauthAccount.mockResolvedValue(Result.ok({} as never));
    repo.createOauthUser.mockResolvedValue(Result.ok({ id: 42 } as never));
});

describe("findOrCreateUser", () => {
    it("signs in a known provider account as its user", async () => {
        repo.getOauthByProvider.mockResolvedValue(Result.ok({ userId: 7 } as never));

        const result = await findOrCreateUser(OauthProvider.GOOGLE, googleUser());

        expect(result).toMatchObject({ success: true, data: 7 });
        expect(repo.getUserByEmail).not.toHaveBeenCalled();
    });

    it("looks up the exact Google id, not a rounded number", async () => {
        await findOrCreateUser(OauthProvider.GOOGLE, googleUser());

        expect(repo.getOauthByProvider).toHaveBeenCalledWith(
            OauthProvider.GOOGLE,
            "112233445566778899001"
        );
    });

    it("refuses to link an unverified email to an existing user", async () => {
        repo.getUserByEmail.mockResolvedValue(Result.ok(existingUser));

        const result = await findOrCreateUser(
            OauthProvider.GOOGLE,
            googleUser({ emailVerified: false })
        );

        expect(result).toMatchObject({ success: false, type: "Unauthorized" });
        expect(repo.linkOauthAccount).not.toHaveBeenCalled();
        expect(repo.createOauthUser).not.toHaveBeenCalled();
    });

    it("links a verified email to the existing user, replacing an outdated account", async () => {
        repo.getUserByEmail.mockResolvedValue(Result.ok(existingUser));

        const result = await findOrCreateUser(OauthProvider.GOOGLE, googleUser());

        expect(result).toMatchObject({ success: true, data: 7 });
        expect(repo.linkOauthAccount).toHaveBeenCalledWith(7, {
            provider: OauthProvider.GOOGLE,
            providerUserId: "112233445566778899001",
            avatarUrl: undefined,
            name: "Anna",
        });
    });

    it("creates a user for a new verified email", async () => {
        const result = await findOrCreateUser(OauthProvider.GITHUB, googleUser({ id: "123" }));

        expect(result).toMatchObject({ success: true, data: 42 });
        expect(repo.createOauthUser).toHaveBeenCalledWith(
            expect.objectContaining({ email: "anna@example.com", providerUserId: "123" })
        );
    });

    it("doesn't create a user for an unverified email", async () => {
        const result = await findOrCreateUser(
            OauthProvider.GITHUB,
            googleUser({ emailVerified: false })
        );

        expect(result.success).toBe(false);
        expect(repo.createOauthUser).not.toHaveBeenCalled();
    });

    it("fails without details when the database fails", async () => {
        repo.getOauthByProvider.mockResolvedValue(Result.error("connection refused"));

        const result = await findOrCreateUser(OauthProvider.GOOGLE, googleUser());

        expect(result).toMatchObject({ success: false, message: "Could not sign in" });
    });
});

describe("OauthUserInfo", () => {
    it("lowercases emails", () => {
        const parsed = OauthUserInfo.parse(googleUser({ email: "Anna@Example.COM" }));
        expect(parsed.email).toBe("anna@example.com");
    });
});
