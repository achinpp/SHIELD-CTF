"use server";

import { redirect } from "next/navigation";

import {
  LoginSchema,
  RegisterSchema,
  toFieldErrors,
  type AccessState,
} from "@/lib/access";
import { DB_UNCONFIGURED, sql } from "@/lib/db";
import { hashPassword, verifyDecoy, verifyPassword } from "@/lib/auth/password";
import {
  RATE_LIMIT_MESSAGE,
  clearAttempts,
  clientIp,
  isRateLimited,
  pruneAttempts,
  recordAttempt,
} from "@/lib/auth/rate-limit";
import {
  createSession,
  destroySession,
  pruneExpiredSessions,
  readSession,
} from "@/lib/auth/session";

/**
 * Authentication Server Actions.
 *
 * These are public endpoints in every sense — a Server Action is reachable by
 * anything that can craft a POST, so nothing here trusts the client. Every
 * input is re-parsed server-side even though the panel already checked it.
 */

const GENERIC_FAILURE = "Invalid codename or passphrase.";

/**
 * Shown when the database cannot be reached at all, as opposed to rejecting
 * something. Worth its own message: "invalid credentials" for an outage sends
 * you hunting for a typo, and the generic failure below is indistinguishable
 * from a genuine one. Naming the cause is not a leak — an attacker can see the
 * service is down anyway.
 */
const UNREACHABLE =
  "Cannot reach the registry — the database is not responding. " +
  "If you are running locally, start it with: npm run db";

/**
 * Shown when there is no database *configured*, as opposed to one that is
 * configured and down. A fresh clone carries no `.env.local` — both env files
 * are gitignored — so this is the first thing a new contributor hits, and it
 * used to surface as the generic failure below. That sent people hunting for a
 * bug in the sign-in form rather than at the one-line setup step they had not
 * done yet. Naming it costs nothing: an unconfigured deployment has no secrets
 * in it to leak.
 */
const UNCONFIGURED =
  "This deployment has no database configured — DATABASE_URL is not set. " +
  "Copy .env.example to .env.local, set DATABASE_URL, start the database " +
  "with `npm run db`, then restart the dev server. See the README.";

/** Where an authenticated agent lands. */
const HOME = "/challenges";

export async function register(
  _prev: AccessState,
  formData: FormData,
): Promise<AccessState> {
  const parsed = RegisterSchema.safeParse({
    codename: formData.get("codename"),
    email: formData.get("email"),
    passphrase: formData.get("passphrase"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) return { errors: toFieldErrors(parsed.error) };

  const { codename, email, passphrase } = parsed.data;
  const passwordHash = await hashPassword(passphrase);

  let userId: string;
  try {
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO users (codename, email, password_hash)
      VALUES (${codename}, ${email}, ${passwordHash})
      RETURNING id
    `;
    userId = row.id;
  } catch (error) {
    // 23505 = unique_violation. Deliberately one message for both columns:
    // naming which one was taken turns registration into a lookup for whether
    // a given email has an account here.
    if (isUniqueViolation(error)) {
      return {
        errors: { codename: "That codename or email is already registered." },
      };
    }
    if (isUnconfigured(error)) return { message: UNCONFIGURED };
    if (isUnreachable(error)) return { message: UNREACHABLE };
    console.error("register failed:", error);
    return { message: "Registration failed. Try again." };
  }

  await createSession(userId);
  redirect(HOME); // throws — must stay outside the try above
}

export async function login(
  _prev: AccessState,
  formData: FormData,
): Promise<AccessState> {
  const parsed = LoginSchema.safeParse({
    identifier: formData.get("identifier"),
    passphrase: formData.get("passphrase"),
  });

  if (!parsed.success) return { errors: toFieldErrors(parsed.error) };

  const identifier = parsed.data.identifier.toLowerCase();
  const { passphrase } = parsed.data;
  const ip = await clientIp();

  // Every database call below is wrapped: an unreachable database used to
  // throw straight out of the action, which Next renders as a 500 error page
  // rather than something the panel can display.
  try {
    if (await isRateLimited(identifier, ip)) {
      return { message: RATE_LIMIT_MESSAGE };
    }

    const [user] = await sql<{ id: string; password_hash: string }[]>`
      SELECT id, password_hash FROM users
      WHERE codename_ci = ${identifier} OR email_ci = ${identifier}
    `;

    // No early return for a missing account: hashing a decoy keeps the
    // response time flat so the form cannot be used to discover which
    // codenames exist.
    const ok = user
      ? await verifyPassword(user.password_hash, passphrase)
      : await verifyDecoy(passphrase);

    if (!ok || !user) {
      await recordAttempt(identifier, ip, false);
      return { message: GENERIC_FAILURE };
    }

    await recordAttempt(identifier, ip, true);
    await clearAttempts(identifier);
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

    await createSession(user.id);

    // Opportunistic housekeeping on a path that already touches the database.
    await Promise.allSettled([pruneExpiredSessions(), pruneAttempts()]);
  } catch (error) {
    if (isUnconfigured(error)) return { message: UNCONFIGURED };
    if (isUnreachable(error)) return { message: UNREACHABLE };
    console.error("login failed:", error);
    return { message: "Sign-in failed. Try again." };
  }

  redirect(HOME);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}

/** Log out everywhere — every session this agent holds, on any device. */
export async function logoutEverywhere(): Promise<void> {
  const user = await readSession();
  if (user) {
    await sql`DELETE FROM sessions WHERE user_id = ${user.id}`;
  }
  await destroySession();
  redirect("/");
}

/**
 * True when the database could not be reached, as opposed to reaching it and
 * being told no.
 *
 * `postgres` raises an AggregateError when every address for the host is
 * refused — IPv6 and IPv4 both — so the individual causes have to be checked
 * as well as the top-level error.
 */
const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ETIMEDOUT",
  "ECONNRESET",
  "EPIPE",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
]);

/** True when no DATABASE_URL was ever set — a setup step, not an outage. */
function isUnconfigured(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === DB_UNCONFIGURED
  );
}

function isUnreachable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && UNREACHABLE_CODES.has(code)) return true;

  const causes = (error as { errors?: unknown }).errors;
  return Array.isArray(causes) && causes.some(isUnreachable);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
