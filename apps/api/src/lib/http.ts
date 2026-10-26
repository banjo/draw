import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Env } from "common";
import cors, { CorsOptions } from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import {
    appRouter,
    createTRPCContext,
    errorMiddleware,
    GithubAuthProvider,
    GoogleAuthProvider,
    handleErrors,
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
app.use(handleErrors(OauthCoreProvider.middleware));

app.use(
    "/trpc",
    createExpressMiddleware({
        maxBodySize: MAX_BODY_SIZE,
        middleware: cors(corsSettings),
        router: appRouter,
        createContext: opts => createTRPCContext(opts),
    })
);

app.get("/login/google/callback", handleErrors(GoogleAuthProvider.callback));
app.get("/login/google", handleErrors(GoogleAuthProvider.login));
app.get("/login/github/callback", handleErrors(GithubAuthProvider.callback));
app.get("/login/github", handleErrors(GithubAuthProvider.login));
// A POST, so a link or image on another site can't sign you out
app.post("/logout", handleErrors(OauthCoreProvider.logout));
app.get("/auth", OauthCoreProvider.authCheck);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.use(errorMiddleware);

const server = createServer(app);

export { app, PORT, server };
