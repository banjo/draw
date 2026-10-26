import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Env } from "common";
import cors, { CorsOptions } from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import {
    appRouter,
    createTRPCContext,
    GithubAuthProvider,
    GoogleAuthProvider,
    NodeContext,
    OauthCoreProvider,
} from "server";

const app = express();
const url = Env.server().CLIENT_URL;
const PORT = Number(Env.server().PORT) || 3003;

// Drawings are JSON without images, which go straight to the bucket
const MAX_BODY_SIZE = 10 * 1024 * 1024;

const corsSettings: CorsOptions = {
    credentials: true,
    origin: url,
    allowedHeaders: ["Content-Type", "Authorization", "Credentials"],
};

app.use(cors(corsSettings));
app.use(NodeContext.setupExpressContext);
app.use(OauthCoreProvider.middleware);

app.use(
    "/trpc",
    createExpressMiddleware({
        maxBodySize: MAX_BODY_SIZE,
        middleware: cors(corsSettings),
        router: appRouter,
        createContext: opts => createTRPCContext(opts),
    })
);

app.get("/login/google/callback", GoogleAuthProvider.callback);
app.get("/login/google", GoogleAuthProvider.login);
app.get("/login/github/callback", GithubAuthProvider.callback);
app.get("/login/github", GithubAuthProvider.login);
app.get("/logout", OauthCoreProvider.logout);
app.get("/auth", OauthCoreProvider.authCheck);
app.get("/health", (_req, res) => {
    return res.status(200).json({ status: "ok" });
});

const server = createServer(app);

export { app, PORT, server };
