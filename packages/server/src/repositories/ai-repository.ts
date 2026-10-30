import { prisma } from "db";
import { AI_FREE_DAILY_LIMIT, AiPlan } from "common";

export type AiKind = "mermaid" | "diagram";

/** The start of today and of tomorrow, in UTC */
const getDay = (now = new Date()) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
};

const getPlan = async (userId: number): Promise<AiPlan> => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    return user?.plan ?? "free";
};

/** Today's requests, and today's fixes of Mermaid diagrams, which aren't counted */
const countToday = async (userId: number) => {
    const { start } = getDay();
    const rows = await prisma.aiRequest.groupBy({
        by: ["isFix"],
        where: { userId, createdAt: { gte: start } },
        _count: true,
    });
    const count = (isFix: boolean) => rows.find(row => row.isFix === isFix)?._count ?? 0;
    return { used: count(false), fixes: count(true) };
};

const getLimit = (plan: AiPlan) => (plan === "pro" ? null : AI_FREE_DAILY_LIMIT);

const add = (userId: number, kind: AiKind, isFix: boolean) =>
    prisma.aiRequest.create({ data: { userId, kind, isFix }, select: { id: true } });

/** Takes back a request that failed, so it isn't counted */
const remove = (id: number) => prisma.aiRequest.delete({ where: { id } }).catch(() => undefined);

export const AiRepository = { getDay, getPlan, getLimit, countToday, add, remove };
