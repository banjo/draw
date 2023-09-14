const raise = (error: string) => {
    throw new Error(error);
};

export const ensureDbReady = () => {
    process.env.POSTGRES_URL ?? raise("POSTGRES_URL is not set");
};
