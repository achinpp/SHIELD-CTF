import "server-only";
import postgres from "postgres";

/**
 * Postgres connection pool.
 *
 * `postgres` sends every interpolated value as a bound parameter, so
 * sql`... where id = ${id}` is not string concatenation and cannot be
 * SQL-injected. Never build a query by joining strings.
 */

type Sql = ReturnType<typeof postgres>;

declare global {
  var __shieldSql: Sql | undefined;
}

function connect(): Sql {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local for local " +
        "development, or let compose.yaml provide it in Docker.",
    );
  }

  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

/**
 * Connecting is deferred to the first query rather than done at import.
 * `next build` imports every module to trace and prerender routes, and there
 * is no database during a Docker image build — eager connection would fail
 * the build over a variable that is only needed at runtime.
 *
 * The global cache exists because Next's dev server re-evaluates modules on
 * each edit; without it the pool would be rebuilt until Postgres refused new
 * connections.
 */
export const sql: Sql = new Proxy((() => {}) as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    const client = (globalThis.__shieldSql ??= connect());
    return (client as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_target, prop, receiver) {
    const client = (globalThis.__shieldSql ??= connect());
    return Reflect.get(client, prop, receiver);
  },
});
