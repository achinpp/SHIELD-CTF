/**
 * Reference solver for stage 08, OPERATION KEYSTONE.
 *
 * The finale only opens if all seven shares hidden in stages 01-07 are
 * exactly right, so one artifact rebuilt carelessly breaks it. Run this after
 * rebuilding any stage artifact:
 *
 *   npm run keystone:verify
 *   npm run keystone:verify -- --shares story.md
 *   npm run keystone:verify -- KS1-<hex> KS2-<hex> ...
 *
 * It holds no shares itself — writing them here would hand the finale to
 * anyone who reads the repository. It scans every stage artifact under
 * `data/challenges/` for a share written out literally, then takes the rest
 * from the command line or from any file passed with `--shares`. Shares
 * planted in an encoded form (Base32, Base64url, Caesar + NATO) or outside
 * the repository (stage 01's git history) have to be supplied that way, so
 * decode those by hand.
 *
 * With all seven in hand it checks that:
 *   - Lagrange interpolation at x = 0 over GF(2^127 - 1) gives printable ASCII,
 *   - SHA-256 of that secret opens keystone.capsule with its GCM tag verified,
 *   - the stand-down phrase in the order matches stage 8's digest in the seed,
 *   - no six of the seven shares open the capsule.
 *
 * Exits non-zero if a share is missing or any check fails.
 */
import { createDecipheriv, createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CAPSULE = path.join(ROOT, "data/challenges/stage-08/keystone.capsule");
const SEED = path.join(ROOT, "db/init/02-challenges.sql");
const P = 2n ** 127n - 1n;
const SHARE = /KS([1-7])-([0-9a-fA-F]{32})/g;

/** x -> { y, from } */
const shares = new Map();
let failed = false;

function add(text, from) {
  for (const [, x, hex] of text.matchAll(SHARE)) {
    const y = BigInt(`0x${hex}`);
    const seen = shares.get(Number(x));
    if (seen && seen.y !== y) {
      console.error(`✗ KS${x} disagrees: ${from} vs ${seen.from}`);
      failed = true;
    } else if (!seen) {
      shares.set(Number(x), { y, from });
    }
  }
}

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else yield full;
  }
}

// Stage 08's own folder is skipped: the capsule must never carry a share.
for (const file of files(path.join(ROOT, "data/challenges"))) {
  if (file.includes(`${path.sep}stage-08${path.sep}`)) continue;
  add(readFileSync(file).toString("latin1"), path.relative(ROOT, file));
}

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--shares") {
    const file = args[++i];
    add(readFileSync(file, "utf8"), file);
  } else {
    add(args[i], "command line");
  }
}

for (let x = 1; x <= 7; x++) {
  const s = shares.get(x);
  console.log(s ? `  KS${x}  ${s.from}` : `✗ KS${x}  missing`);
  if (!s) failed = true;
}
if (failed) {
  console.error("\nKEYSTONE cannot be verified: supply the missing shares.");
  process.exit(1);
}

const mod = (a) => ((a % P) + P) % P;
function inverse(a) {
  // Fermat: P is prime.
  let result = 1n;
  let base = mod(a);
  for (let e = P - 2n; e > 0n; e >>= 1n) {
    if (e & 1n) result = (result * base) % P;
    base = (base * base) % P;
  }
  return result;
}
function interpolate(points) {
  let secret = 0n;
  for (const [xi, yi] of points) {
    let num = 1n;
    let den = 1n;
    for (const [xj] of points) {
      if (xj === xi) continue;
      num = mod(num * -xj);
      den = mod(den * (xi - xj));
    }
    secret = mod(secret + yi * num * inverse(den));
  }
  return Buffer.from(secret.toString(16).padStart(32, "0"), "hex");
}

const capsule = JSON.parse(readFileSync(CAPSULE, "utf8"));
const b64url = (s) => Buffer.from(s, "base64url");
function open(secret) {
  const key = createHash("sha256").update(secret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, b64url(capsule.iv));
  decipher.setAAD(Buffer.from(capsule.aad));
  decipher.setAuthTag(b64url(capsule.tag));
  return Buffer.concat([decipher.update(b64url(capsule.ciphertext)), decipher.final()]).toString("utf8");
}

const points = [...shares].map(([x, { y }]) => [BigInt(x), y]);
const secret = interpolate(points);
const check = (ok, what) => {
  console.log(`${ok ? "✓" : "✗"} ${what}`);
  if (!ok) failed = true;
};

check(/^[\x20-\x7e]{16}$/.test(secret.toString("latin1")), "secret is 16 printable ASCII bytes");

let order = null;
try {
  order = open(secret);
  check(true, "capsule opens, GCM tag verified");
} catch {
  check(false, "capsule opens, GCM tag verified (a share is wrong)");
}

if (order !== null) {
  const phrase = order.trim().split("\n").at(-1);
  const digest = createHash("sha256").update(phrase).digest("hex");
  const seed = readFileSync(SEED, "utf8");
  const stage8 = seed.slice(seed.indexOf("(8, 'stage-08'"));
  const seeded = stage8.match(/decode\('([0-9a-f]{64})', 'hex'\)/)?.[1];
  check(digest === seeded, "stand-down phrase matches stage 8's digest in the seed");
}

let sixOpen = 0;
for (const [x] of points) {
  try {
    open(interpolate(points.filter(([xj]) => xj !== x)));
    sixOpen++;
  } catch {
    // expected: six shares must not be enough
  }
}
check(sixOpen === 0, "no six of the seven shares open the capsule");

if (failed) process.exit(1);
console.log("\nKEYSTONE verified.");
