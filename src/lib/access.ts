import * as z from "zod";

/**
 * Credential rules, shared by the browser and the server.
 *
 * One definition on purpose: the panel uses it for instant feedback, the
 * Server Action re-runs it before touching the database. The client copy is a
 * courtesy to the user and nothing more — anything can POST to a Server
 * Action, so the server-side parse is the one that counts.
 */

export type Mode = "login" | "register";

export const MIN_PASSPHRASE = 12;
/** Bounds the work a single request can ask Argon2 to do. */
export const MAX_PASSPHRASE = 128;

export const CODENAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const codename = z
  .string()
  .trim()
  .min(3, "Codename must be at least 3 characters.")
  .max(24, "Codename must be at most 24 characters.")
  .regex(
    CODENAME_PATTERN,
    "Letters, numbers, underscore and hyphen only.",
  );

const email = z
  .string()
  .trim()
  .min(1, "Enter an email for recovery.")
  .max(254, "That email is too long.")
  .pipe(z.email("That does not look like an email address."));

const passphrase = z
  .string()
  .min(MIN_PASSPHRASE, `Passphrase must be at least ${MIN_PASSPHRASE} characters.`)
  .max(MAX_PASSPHRASE, `Passphrase must be at most ${MAX_PASSPHRASE} characters.`);

export const LoginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your codename or email."),
  passphrase: z.string().min(1, "Enter your passphrase."),
});

export const RegisterSchema = z
  .object({
    codename,
    email,
    passphrase,
    confirm: z.string().min(1, "Repeat the passphrase."),
  })
  // Length beats composition rules, but a passphrase built out of the
  // codename is guessable no matter how long it is.
  .refine(
    (v) => !v.passphrase.toLowerCase().includes(v.codename.toLowerCase()),
    { path: ["passphrase"], error: "Your passphrase cannot contain your codename." },
  )
  .refine((v) => v.passphrase === v.confirm, {
    path: ["confirm"],
    error: "Passphrases do not match.",
  });

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

export type FieldErrors = Partial<Record<keyof AccessFields, string>>;

/** What a Server Action hands back to `useActionState`. */
export type AccessState = {
  errors?: FieldErrors;
  message?: string;
} | null;

/** Order decides which field gets focused when several fail at once. */
const ORDER: Record<Mode, (keyof AccessFields)[]> = {
  login: ["identifier", "passphrase"],
  register: ["codename", "email", "passphrase", "confirm"],
};

export function firstErrorField(
  mode: Mode,
  errors: FieldErrors,
): keyof AccessFields | undefined {
  return ORDER[mode].find((field) => errors[field]);
}

/** Collapse a Zod failure into one message per field. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof AccessFields | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Client-side pre-check. The server validates again regardless. */
export function validate(mode: Mode, fields: AccessFields): FieldErrors {
  const result =
    mode === "login"
      ? LoginSchema.safeParse({
          identifier: fields.identifier,
          passphrase: fields.passphrase,
        })
      : RegisterSchema.safeParse({
          codename: fields.codename,
          email: fields.email,
          passphrase: fields.passphrase,
          confirm: fields.confirm,
        });

  return result.success ? {} : toFieldErrors(result.error);
}
