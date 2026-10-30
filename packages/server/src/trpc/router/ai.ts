import { TRPCError } from "@trpc/server";
import { AiDiagramInput, AiMermaidInput, AiStatus } from "common";
import { createContextLogger } from "../../lib/context-logger";
import { AiKind, AiRepository } from "../../repositories/ai-repository";
import { AiService } from "../../services/ai-service";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const logger = createContextLogger("ai-router");

/** Users with a request on its way, who wait for it before asking again */
const busy = new Set<number>();

const getStatus = async (userId: number): Promise<AiStatus> => {
    const [plan, { used }] = await Promise.all([
        AiRepository.getPlan(userId),
        AiRepository.countToday(userId),
    ]);
    return {
        plan,
        used,
        limit: AiRepository.getLimit(plan),
        resetsAt: AiRepository.getDay().end.toISOString(),
        isEnabled: AiService.isEnabled(),
    };
};

/**
 * Asks the AI if today's limit allows it, and counts the request. One that fails isn't
 * counted. A fix of a Mermaid diagram isn't counted either, but there can't be more of those
 * than requests.
 */
const withLimit = async <T>(
    userId: number,
    kind: AiKind,
    isFix: boolean,
    run: () => Promise<T>
): Promise<T> => {
    if (!AiService.isEnabled()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI is turned off" });
    }
    if (busy.has(userId)) {
        throw new TRPCError({ code: "CONFLICT", message: "Wait for the last request" });
    }

    busy.add(userId);
    try {
        const [plan, { used, fixes }] = await Promise.all([
            AiRepository.getPlan(userId),
            AiRepository.countToday(userId),
        ]);
        const limit = AiRepository.getLimit(plan);
        if (limit !== null && (isFix ? fixes >= used : used >= limit)) {
            throw new TRPCError({
                code: "TOO_MANY_REQUESTS",
                message: "You've used today's AI requests",
            });
        }

        const request = await AiRepository.add(userId, kind, isFix);
        try {
            return await run();
        } catch (error) {
            await AiRepository.remove(request.id);
            logger.error({ error, kind }, "AI request failed");
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "The AI couldn't make it. Try again, or say it differently.",
            });
        }
    } finally {
        busy.delete(userId);
    }
};

export const aiRouter = createTRPCRouter({
    /** The plan, and how many requests are left today */
    status: protectedProcedure.query(({ ctx }) => getStatus(ctx.session.userId)),

    /** BanjoDraw's shapes and blocks, from a request and maybe what's selected */
    diagram: protectedProcedure
        .input(AiDiagramInput)
        .mutation(({ ctx, input }) =>
            withLimit(ctx.session.userId, "diagram", false, () => AiService.createDiagram(input))
        ),

    /** A Mermaid diagram, from a request and maybe what's selected */
    mermaid: protectedProcedure
        .input(AiMermaidInput)
        .mutation(({ ctx, input }) =>
            withLimit(ctx.session.userId, "mermaid", Boolean(input.fix), () =>
                AiService.createMermaid(input)
            )
        ),
});
