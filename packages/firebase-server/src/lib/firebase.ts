import { Env } from "common";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import "dotenv/config";

const env = Env.server();

const serviceAccount = {
    key: env.FIREBASE_ADMIN_KEY,
};

const firebaseBuffer = Buffer.from(serviceAccount.key, "base64");
const firebaseKey = firebaseBuffer.toString("utf8");

const app = initializeApp({
    credential: cert(JSON.parse(firebaseKey)),
});

export const auth = getAuth(app);
