import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const migrationsDir = new URL("../prisma/migrations/", import.meta.url);

const readMigration = name =>
    readFileSync(new URL(`${name}/migration.sql`, migrationsDir), "utf8");

/** The SQL of a migration, and of every migration before it */
export const loadMigration = name => ({
    migration: readMigration(name),
    baseline: readdirSync(migrationsDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name < name)
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b))
        .map(readMigration)
        .join("\n"),
});

const docker = (args, input) => {
    const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 120000 });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.error?.message || "Docker command failed");
    }
    return result.stdout.trim();
};

/** An isolated PostgreSQL 17 in Docker, without network access */
export const startPostgres = async () => {
    const container = docker([
        "run",
        "--detach",
        "--rm",
        "--network",
        "none",
        "--name",
        `banjodraw-migrations-${randomUUID()}`,
        "--env",
        "POSTGRES_HOST_AUTH_METHOD=trust",
        "postgres:17.5-alpine",
    ]);

    const sql = (database, input) =>
        docker(
            [
                "exec",
                "-i",
                container,
                "psql",
                "-X",
                "-U",
                "postgres",
                "-d",
                database,
                "-v",
                "ON_ERROR_STOP=1",
                "-Atq",
            ],
            input
        );

    let databaseNumber = 0;
    /** A new database with the given SQL applied */
    const createDatabase = (...setup) => {
        const database = `migration_test_${++databaseNumber}`;
        sql("postgres", `CREATE DATABASE "${database}";`);
        setup.forEach(input => sql(database, input));
        return database;
    };

    const stop = () => docker(["rm", "--force", "--volumes", container]);

    for (let attempt = 0; attempt < 60; attempt++) {
        try {
            // Wait until the entrypoint has replaced itself with the final server.
            docker(["exec", container, "sh", "-c", 'test "$(cat /proc/1/comm)" = postgres']);
            sql("postgres", "SELECT 1;");
            return { sql, createDatabase, stop };
        } catch {
            await setTimeout(500);
        }
    }

    stop();
    throw new Error("Test PostgreSQL did not start");
};
