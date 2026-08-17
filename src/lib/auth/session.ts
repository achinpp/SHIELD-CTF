import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { sql } from "@/lib/db";

export const SESSION_COOKIE = "shield_session";

/** Sessions last a week; long enough for a CTF event, short enough to expire. */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The cookie holds a raw 256-bit token; the database holds only its SHA-256.
 * A plain hash is right here (unlike for passwords): the token is full-entropy
 * random, so there is no dictionary to attack and no need to be slow.
 */
function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

/** Issue a session for `userId` and set the cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(token)}, ${userId}, ${expiresAt})
  `;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true, // unreadable from JavaScript, so XSS cannot steal it
    secure: process.env.NODE_ENV === "production", // dev runs on plain http
    sameSite: "lax", // not sent on cross-site POSTs, blunting CSRF
    path: "/",
    expires: expiresAt,
  });
}

export type SessionUser = {
  id: string;
  codename: string;
};

/**
 * Resolve the current session against the database.
 *
 * Every call is a real lookup, so revoking a session takes effect immediately
 * — the reason for preferring server-side sessions over a self-contained JWT,
 * which stays valid until it expires no matter what the server thinks.
 */
export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await sql<{ id: string; codename: string }[]>`
    SELECT u.id, u.codename
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.expires_at > now()
  `;

  return rows[0] ?? null;
}

/** Drop the current session server-side and clear the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    // Deleting the row is what actually logs the user out. Clearing the
    // cookie alone would leave a token that still works if it was captured.
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  }

  store.delete(SESSION_COOKIE);
}

/** Housekeeping for expired rows. Safe to call opportunistically. */
export async function pruneExpiredSessions(): Promise<void> {
  await sql`DELETE FROM sessions WHERE expires_at <= now()`;
}
