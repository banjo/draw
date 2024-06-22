import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "server";

// Type error here, not sure how to fix
export const trpc = createTRPCReact<AppRouter>();
