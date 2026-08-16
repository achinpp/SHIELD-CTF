/**
 * Credential rules for the access panel.
 *
 * Validation lives here rather than in the component so the real backend can
 * reuse the exact same rules server-side — client checks are a courtesy to the
 * user, never a security control.
 */

export type Mode = "login" | "register";

/** Every field the panel can render, across both modes. */
export type AccessFields = {
  identifier: string;
  codename: string;
  email: string;
  passphrase: string;
  confirm: string;
};

export const EMPTY_FIELDS: AccessFields = {
  identifier: "",
  codename: "",
  email: "",
  passphrase: "",
  confirm: "",
};

/** Field name → message. A field is only listed when it failed. */
export type FieldErrors = Partial<Record<keyof AccessFields, string>>;

export type Validation =
  | { ok: true }
  | { ok: false; errors: FieldErrors; first: keyof AccessFields };

export const CODENAME_PATTERN = /^[a-zA-Z0-9_-]{3,24}$/;

/** Deliberately loose: a local-part, an @, and a dotted domain. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSPHRASE = 10;

/** Order matters — the first failure is what gets focused. */
const LOGIN_ORDER: (keyof AccessFields)[] = ["identifier", "passphrase"];
const REGISTER_ORDER: (keyof AccessFields)[] = [
  "codename",
  "email",
  "passphrase",
  "confirm",
];

function finish(
  errors: FieldErrors,
  order: (keyof AccessFields)[],
): Validation {
  const first = order.find((field) => errors[field]);
  return first ? { ok: false, errors, first } : { ok: true };
}

export function validateLogin(fields: AccessFields): Validation {
  const errors: FieldErrors = {};

  if (!fields.identifier.trim()) {
    errors.identifier = "Enter your codename or registered email.";
  }
  if (!fields.passphrase) {
    errors.passphrase = "Enter your passphrase.";
  }

  return finish(errors, LOGIN_ORDER);
}

export function validateRegister(fields: AccessFields): Validation {
  const errors: FieldErrors = {};
  const codename = fields.codename.trim();

  if (!codename) {
    errors.codename = "Pick a codename.";
  } else if (!CODENAME_PATTERN.test(codename)) {
    errors.codename =
      "3–24 characters, letters/numbers/underscore/hyphen only.";
  }

  if (!fields.email.trim()) {
    errors.email = "Enter an email for recovery.";
  } else if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "That does not look like an email address.";
  }

  if (!fields.passphrase) {
    errors.passphrase = "Choose a passphrase.";
  } else if (fields.passphrase.length < MIN_PASSPHRASE) {
    errors.passphrase = `At least ${MIN_PASSPHRASE} characters.`;
  } else if (
    codename &&
    fields.passphrase.toLowerCase().includes(codename.toLowerCase())
  ) {
    errors.passphrase = "Your passphrase cannot contain your codename.";
  }

  if (!fields.confirm) {
    errors.confirm = "Repeat the passphrase.";
  } else if (fields.confirm !== fields.passphrase) {
    errors.confirm = "Passphrases do not match.";
  }

  return finish(errors, REGISTER_ORDER);
}

export function validate(mode: Mode, fields: AccessFields): Validation {
  return mode === "login" ? validateLogin(fields) : validateRegister(fields);
}

/**
 * ── BACKEND SEAM ────────────────────────────────────────────────────────────
 * There is no auth service yet, so this resolves without transmitting or
 * storing anything: the passphrase never leaves this function's arguments.
 *
 * Replace the body with the real call (a Server Action, or `fetch` to the auth
 * route) once accounts exist. Keep the shape — the panel already handles a
 * failed outcome with a message, so a real "invalid credentials" response
 * needs no UI changes.
 */
/* eslint-disable @typescript-eslint/no-unused-vars -- the seam keeps the real
   call's signature; both arguments are used once this talks to a backend. */
export async function submitAccess(
  mode: Mode,
  fields: AccessFields,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Stands in for network latency so the pending state is visible.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { ok: true };
}
/* eslint-enable @typescript-eslint/no-unused-vars */
