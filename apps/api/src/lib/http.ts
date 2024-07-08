import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { Env } from "common";
import cors, { CorsOptions } from "cors";
import "dotenv/config";
import express from "express";
import {
    appRouter,
    BucketService,
    createContextLogger,
    createTRPCContext,
    GithubAuthProvider,
    NodeContext,
    OauthCoreProvider,
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
app.use(OauthCoreProvider.middleware);

app.get("/bucket-test", async (req, res) => {
    const t = await BucketService.generatePresignedUrlForWrite("slackpicke2.jpg");
    logger.info({ t }, "bucket-test");
    res.json({ t });
});

app.use(
    "/trpc",
    createExpressMiddleware({
        middleware: cors(corsSettings),
        router: appRouter,
        createContext: opts => createTRPCContext(opts),
    })
);

app.get("/login/github/callback", GithubAuthProvider.callback);
app.get("/login/github", GithubAuthProvider.login);
app.get("/logout", OauthCoreProvider.logout);
app.get("/auth", OauthCoreProvider.authCheck);

export { app, PORT };
