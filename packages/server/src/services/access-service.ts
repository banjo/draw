import { toMilliseconds } from "@banjoanton/utils";
import { DrawingAccess, DrawingRole, LinkAccess, Result, Slug } from "common";
import EventEmitter from "node:events";
import { createContextLogger } from "../lib/context-logger";
import { DrawRepository } from "../repositories/draw-repository";

const logger = createContextLogger("access-service");

/**
 * Settings are kept this long, so changes sent many times a second don't each ask the
 * database. Only this server changes them, and it updates its copy when it does.
 */
const CACHE_FOR = toMilliseconds({ minutes: 5 });
const MAX_CACHED = 10_000;

type AccessSettings = {
    ownerId: number | null;
    linkAccess: LinkAccess;
};

const cache = new Map<Slug, { settings: AccessSettings; expiresAt: number }>();

// One listener per open subscription, so the default limit of 10 is too low
const changes = new EventEmitter().setMaxListeners(0);
const changeEvent = (slug: Slug) => `access:${slug}`;

const remember = (slug: Slug, settings: AccessSettings) => {
    if (cache.size >= MAX_CACHED) cache.clear();
    cache.set(slug, { settings, expiresAt: Date.now() + CACHE_FOR });
};

/** Who owns the drawing and what the link allows, or undefined if it doesn't exist */
const getSettings = async (slug: Slug) => {
    const cached = cache.get(slug);
    if (cached && cached.expiresAt > Date.now()) return Result.ok(cached.settings);

    const result = await DrawRepository.getAccessSettings(slug);
    if (!result.success) return result;
    if (result.data) remember(slug, result.data);
    return Result.ok(result.data);
};

/** The user's role on the drawing (userId undefined when signed out), or undefined if it doesn't exist */
const getRole = async (slug: Slug, userId?: number) => {
    const settings = await getSettings(slug);
    if (!settings.success) return settings;
    if (!settings.data) return Result.ok(undefined);
    return Result.ok(DrawingAccess.roleFor(settings.data, userId));
};

/** Change what anyone with the link can do. Only the owner can. */
const setLinkAccess = async (slug: Slug, userId: number, linkAccess: LinkAccess) => {
    // Straight from the database, as ownership decides it
    const current = await DrawRepository.getAccessSettings(slug);
    if (!current.success) return current;
    if (!current.data) return Result.error("Drawing not found", { type: "NotFound" });
    if (current.data.ownerId !== userId) {
        return Result.error("Not owner of drawing", { type: "Unauthorized" });
    }

    const updated = await DrawRepository.updateLinkAccess(slug, linkAccess);
    if (!updated.success) return updated;

    const settings = { ownerId: current.data.ownerId, linkAccess };
    remember(slug, settings);
    changes.emit(changeEvent(slug), settings);
    logger.info({ slug, linkAccess }, "Link access changed");
    return Result.ok();
};

/**
 * Listen to changes of who can open the drawing. The listener gets the role a user has now.
 * Returns a function that stops listening.
 */
const onRoleChange = (
    slug: Slug,
    userId: number | undefined,
    listener: (role: DrawingRole) => void
) => {
    const onChange = (settings: AccessSettings) =>
        listener(DrawingAccess.roleFor(settings, userId));
    changes.on(changeEvent(slug), onChange);
    return () => {
        changes.off(changeEvent(slug), onChange);
    };
};

/** For tests */
const clearCache = () => cache.clear();

export const AccessService = {
    getRole,
    setLinkAccess,
    onRoleChange,
    clearCache,
};
