import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Env } from "common";
import cors, { CorsOptions } from "cors";
import "dotenv/config";
import express from "express";
import {
    appRouter,
    createContextLogger,
    createTRPCContext,
    GithubAuthProvider,
    NodeContext,
} from "server";

const app = express();
const url = Env.server().CLIENT_URL;
const PORT = Number(Env.server().PORT) || 3003;
const logger = createContextLogger("http");

const corsSettings: CorsOptions = {
    credentials: true,
    origin: url,
    allowedHeaders: ["Content-Type", "Authorization", "Credentials"],
};

app.use(cors(corsSettings));
app.use(NodeContext.setupExpressContext);
app.use(GithubAuthProvider.handleExpressMiddleware);

app.use(
    "/trpc",
    createExpressMiddleware({
        middleware: cors(corsSettings),
        router: appRouter,
        createContext: opts => createTRPCContext(opts),
    })
);

app.get("/login/github/callback", GithubAuthProvider.handleExpressCallback);
app.get("/login/github", GithubAuthProvider.handleExpressLogin);
app.get("/logout", GithubAuthProvider.handleExpressSignOut);
app.get("/auth", (req, res) => {
    if (!res.locals.user && !res.locals.session) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    logger.trace("User is authenticated");
    return res.json({ ok: true });
});

export { app, PORT };
