import "server-only";
import { hash, verify, type Options } from "@node-rs/argon2";

/**
 * `Algorithm` is an ambient `const enum`, which `isolatedModules` forbids
 * importing as a value, so the member is spelled out. 2 = Argon2id, per
 * @node-rs/argon2's index.d.ts.
 */
const ARGON2ID = 2 as NonNullable<Options["algorithm"]>;

/**
 * Password hashing.
 *
 * Argon2id is the OWASP first choice: memory-hard, so the GPU and ASIC rigs
 * that make bcrypt/PBKDF2 cracking cheap gain far less. Parameters follow the
 * OWASP Password Storage Cheat Sheet's Argon2id baseline.
 */
const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  // The salt is generated per hash and embedded in the returned PHC string,
  // so identical passwords never share a hash.
  return hash(password, PARAMS);
}

/**
 * A hash of a throwaway value, used to spend the same CPU time when the
 * account does not exist. Without it, a missing account returns noticeably
 * faster than a wrong password and the login form becomes a user-enumeration
 * oracle. Computed once at module load.
 */
const DECOY = hashPassword(
  "decoy-value-never-a-real-password-" + Math.random(),
);

export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password, PARAMS);
  } catch {
    // A malformed hash in the database must read as "wrong password", never
    // as an unhandled error that leaks a stack trace.
    return false;
  }
}

/** Burn equivalent time on a login for an account that does not exist. */
export async function verifyDecoy(password: string): Promise<false> {
  await verifyPassword(await DECOY, password);
  return false;
}
