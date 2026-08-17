import "server-only";
import { headers } from "next/headers";

import { sql } from "@/lib/db";

/**
 * Login throttling.
 *
 * Two independent limits, because they stop different attacks: per-identifier
 * blocks guessing one account's passphrase, per-IP blocks spraying one common
 * passphrase across many accounts. Counting lives in Postgres rather than in
 * process memory so the limit survives a restart and holds across replicas.
 */

const WINDOW_MINUTES = 15;
const MAX_PER_IDENTIFIER = 5;
const MAX_PER_IP = 20;

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is caller-supplied and trivially spoofed unless a proxy
 * you control overwrites it. Treated as a throttling hint only — never as
 * identity, and never as the sole limit, which is why the per-identifier
 * count above stands on its own.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (!candidate) return null;
  // Postgres `inet` rejects anything malformed, so screen it here first.
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate : null;
}

export async function isRateLimited(
  identifier: string,
  ip: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const [byIdentifier] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM login_attempts
    WHERE identifier = ${identifier}
      AND succeeded = false
      AND attempted_at > ${since}
  `;
  if (byIdentifier.n >= MAX_PER_IDENTIFIER) return true;

  if (ip) {
    const [byIp] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM login_attempts
      WHERE ip = ${ip}::inet
        AND succeeded = false
        AND attempted_at > ${since}
    `;
    if (byIp.n >= MAX_PER_IP) return true;
  }

  return false;
}

export async function recordAttempt(
  identifier: string,
  ip: string | null,
  succeeded: boolean,
): Promise<void> {
  await sql`
    INSERT INTO login_attempts (identifier, ip, succeeded)
    VALUES (${identifier}, ${ip}::inet, ${succeeded})
  `;
}

/** A successful login clears that account's strikes. */
export async function clearAttempts(identifier: string): Promise<void> {
  await sql`DELETE FROM login_attempts WHERE identifier = ${identifier}`;
}

/** Drop rows past the window so the table cannot grow without bound. */
export async function pruneAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  await sql`DELETE FROM login_attempts WHERE attempted_at <= ${cutoff}`;
}

export const RATE_LIMIT_MESSAGE = `Too many failed attempts. Wait ${WINDOW_MINUTES} minutes and try again.`;
