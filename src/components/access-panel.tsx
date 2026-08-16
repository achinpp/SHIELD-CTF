"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  EMPTY_FIELDS,
  MIN_PASSPHRASE,
  submitAccess,
  validate,
  type AccessFields,
  type FieldErrors,
  type Mode,
} from "@/lib/access";

const MODES: { id: Mode; label: string }[] = [
  { id: "login", label: "SIGN IN" },
  { id: "register", label: "ENLIST" },
];

/** Corner brackets, matching the HUD frame treatment. */
const CORNERS = [
  "left-0 top-0 border-l border-t",
  "right-0 top-0 border-r border-t",
  "left-0 bottom-0 border-l border-b",
  "right-0 bottom-0 border-r border-b",
] as const;

const FIELD_CLASS =
  "w-full border border-signal/25 bg-void/70 px-3 py-2.5 font-mono text-sm tracking-wide text-signal outline-none transition-colors placeholder:text-signal/25 focus:border-signal/70 focus:bg-signal/[0.04] aria-[invalid=true]:border-alert/70";

const LABEL_CLASS =
  "block font-mono text-[10px] tracking-[0.25em] text-signal/50";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Login / register modal for the landing CTA.
 *
 * Built on a native `<dialog>` so focus trapping, Escape, and top-layer
 * stacking come from the platform — the surrounding stage is `overflow-hidden`,
 * which would otherwise clip a plain absolutely-positioned panel.
 */
export function AccessPanel({ open, onClose }: Props) {
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ids = useId();

  const [mode, setMode] = useState<Mode>("login");
  const [fields, setFields] = useState<AccessFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reveal, setReveal] = useState(false);

  const fieldId = (name: keyof AccessFields) => `${ids}-${name}`;
  const errorId = (name: keyof AccessFields) => `${ids}-${name}-error`;

  const set = (name: keyof AccessFields) => (value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
    // Clear the complaint as soon as the agent starts fixing it.
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  /**
   * Reset everything, including the passphrases, on the way out. Mode goes
   * back to sign-in too, so the panel always reopens in a known state.
   */
  const reset = useCallback(() => {
    setMode("login");
    setFields(EMPTY_FIELDS);
    setErrors({});
    setFormError(null);
    setPending(false);
    setReveal(false);
  }, []);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setErrors({});
    setFormError(null);
    setReveal(false);
    // Carry nothing but the identifier across — passphrase rules differ.
    setFields((prev) => ({
      ...EMPTY_FIELDS,
      identifier: next === "login" ? prev.codename || prev.identifier : "",
      codename: next === "register" ? prev.identifier || prev.codename : "",
    }));
  };

  // Drive the native dialog from the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
  }, [open]);

  // Focus the first field once the panel is up.
  useEffect(() => {
    if (!open) return;
    const first = mode === "login" ? "identifier" : "codename";
    const input = document.getElementById(fieldId(first));
    // Wait a frame so focus lands after the dialog has been promoted.
    const raf = requestAnimationFrame(() => input?.focus());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setFormError(null);
    const result = validate(mode, fields);

    if (!result.ok) {
      setErrors(result.errors);
      document.getElementById(fieldId(result.first))?.focus();
      return;
    }

    setErrors({});
    setPending(true);
    const outcome = await submitAccess(mode, fields);

    if (!outcome.ok) {
      setPending(false);
      setFormError(outcome.message);
      return;
    }

    reset();
    onClose();
    router.push("/briefing");
  }

  const isRegister = mode === "register";

  return (
    <dialog
      ref={dialogRef}
      // Escape fires `cancel`; route it through the parent so the exit
      // animation runs instead of the dialog vanishing outright.
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        // Clicks on the dialog element itself are backdrop clicks.
        if (event.target === dialogRef.current && !pending) onClose();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      // `body` is `overflow: hidden`, so the panel has to do its own scrolling
      // when the register form is taller than a short viewport.
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto bg-transparent p-0 text-signal backdrop:bg-void/80 backdrop:backdrop-blur-sm"
    >
      <AnimatePresence
        onExitComplete={() => {
          dialogRef.current?.close();
          reset();
        }}
      >
        {open && (
          <motion.div
            className="relative border border-signal/30 bg-hull/95 p-6 shadow-[0_0_60px_rgba(5,10,18,0.9)] sm:p-8"
            initial={prefersReduced ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, y: 8, scale: 0.98 }
            }
            transition={{ duration: prefersReduced ? 0 : 0.28, ease: "easeOut" }}
          >
            <div
              aria-hidden
              className="scanlines pointer-events-none absolute inset-0 opacity-20"
            />
            {CORNERS.map((corner) => (
              <span
                key={corner}
                aria-hidden
                className={`pointer-events-none absolute size-4 border-signal/60 ${corner}`}
              />
            ))}

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.3em] text-alert">
                    RESTRICTED ACCESS
                  </p>
                  <h2 className="mt-2 font-mono text-lg font-semibold tracking-[0.2em] text-signal">
                    AGENT TERMINAL
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  aria-label="Close"
                  className="-mr-1 -mt-1 px-2 py-1 font-mono text-base text-signal/45 transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-30"
                >
                  ✕
                </button>
              </div>

              {/* Mode switch */}
              <div
                role="tablist"
                aria-label="Access mode"
                className="mt-6 grid grid-cols-2 border border-signal/25"
              >
                {MODES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={mode === id}
                    onClick={() => switchMode(id)}
                    disabled={pending}
                    className={`py-2 font-mono text-[10px] tracking-[0.3em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal disabled:opacity-50 ${
                      mode === id
                        ? "bg-signal/15 text-signal"
                        : "text-signal/40 hover:text-signal/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                {isRegister ? (
                  <Field
                    id={fieldId("codename")}
                    errorId={errorId("codename")}
                    label="CODENAME"
                    error={errors.codename}
                  >
                    <input
                      id={fieldId("codename")}
                      name="codename"
                      value={fields.codename}
                      onChange={(e) => set("codename")(e.target.value)}
                      autoComplete="username"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={pending}
                      aria-invalid={Boolean(errors.codename)}
                      aria-describedby={
                        errors.codename ? errorId("codename") : undefined
                      }
                      placeholder="nightingale_07"
                      className={FIELD_CLASS}
                    />
                  </Field>
                ) : (
                  <Field
                    id={fieldId("identifier")}
                    errorId={errorId("identifier")}
                    label="CODENAME OR EMAIL"
                    error={errors.identifier}
                  >
                    <input
                      id={fieldId("identifier")}
                      name="identifier"
                      value={fields.identifier}
                      onChange={(e) => set("identifier")(e.target.value)}
                      autoComplete="username"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={pending}
                      aria-invalid={Boolean(errors.identifier)}
                      aria-describedby={
                        errors.identifier ? errorId("identifier") : undefined
                      }
                      placeholder="nightingale_07"
                      className={FIELD_CLASS}
                    />
                  </Field>
                )}

                {isRegister && (
                  <Field
                    id={fieldId("email")}
                    errorId={errorId("email")}
                    label="SECURE CHANNEL"
                    error={errors.email}
                  >
                    <input
                      id={fieldId("email")}
                      name="email"
                      type="email"
                      value={fields.email}
                      onChange={(e) => set("email")(e.target.value)}
                      autoComplete="email"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={pending}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={
                        errors.email ? errorId("email") : undefined
                      }
                      placeholder="agent@shield.ops"
                      className={FIELD_CLASS}
                    />
                  </Field>
                )}

                <Field
                  id={fieldId("passphrase")}
                  errorId={errorId("passphrase")}
                  label="PASSPHRASE"
                  error={errors.passphrase}
                  hint={
                    isRegister && !errors.passphrase
                      ? `${MIN_PASSPHRASE}+ characters`
                      : undefined
                  }
                >
                  <div className="relative">
                    <input
                      id={fieldId("passphrase")}
                      name="passphrase"
                      type={reveal ? "text" : "password"}
                      value={fields.passphrase}
                      onChange={(e) => set("passphrase")(e.target.value)}
                      autoComplete={
                        isRegister ? "new-password" : "current-password"
                      }
                      disabled={pending}
                      aria-invalid={Boolean(errors.passphrase)}
                      aria-describedby={
                        errors.passphrase ? errorId("passphrase") : undefined
                      }
                      placeholder="••••••••••"
                      className={`${FIELD_CLASS} pr-16`}
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((v) => !v)}
                      disabled={pending}
                      aria-pressed={reveal}
                      className="absolute inset-y-0 right-0 px-3 font-mono text-[10px] tracking-[0.2em] text-signal/40 transition-colors hover:text-signal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal disabled:opacity-40"
                    >
                      {reveal ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </Field>

                {isRegister && (
                  <Field
                    id={fieldId("confirm")}
                    errorId={errorId("confirm")}
                    label="CONFIRM PASSPHRASE"
                    error={errors.confirm}
                  >
                    <input
                      id={fieldId("confirm")}
                      name="confirm"
                      type={reveal ? "text" : "password"}
                      value={fields.confirm}
                      onChange={(e) => set("confirm")(e.target.value)}
                      autoComplete="new-password"
                      disabled={pending}
                      aria-invalid={Boolean(errors.confirm)}
                      aria-describedby={
                        errors.confirm ? errorId("confirm") : undefined
                      }
                      placeholder="••••••••••"
                      className={FIELD_CLASS}
                    />
                  </Field>
                )}

                <p aria-live="polite" className="min-h-4">
                  {formError && (
                    <span className="font-mono text-[11px] tracking-wide text-alert-soft">
                      {formError}
                    </span>
                  )}
                </p>

                <button
                  type="submit"
                  disabled={pending}
                  className="group flex w-full items-center justify-center gap-3 border border-signal/50 bg-signal/10 py-3 font-mono text-[11px] tracking-[0.3em] text-signal transition-colors hover:border-signal hover:bg-signal/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-wait disabled:opacity-60"
                >
                  {pending ? (
                    <>
                      VERIFYING
                      <span className="caret-blink">_</span>
                    </>
                  ) : (
                    <>
                      {isRegister ? "REQUEST CLEARANCE" : "AUTHENTICATE"}
                      <span className="transition-transform group-hover:translate-x-1">
                        &rsaquo;
                      </span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center font-mono text-[10px] leading-relaxed tracking-[0.15em] text-signal/30">
                {isRegister ? "ALREADY CLEARED?" : "NO CLEARANCE ON FILE?"}{" "}
                <button
                  type="button"
                  onClick={() => switchMode(isRegister ? "login" : "register")}
                  disabled={pending}
                  className="tracking-[0.15em] text-signal/60 underline underline-offset-4 transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-50"
                >
                  {isRegister ? "SIGN IN" : "ENLIST"}
                </button>
              </p>

              {/* Honest about what this does today — remove once the auth
                  service in `src/lib/access.ts` is wired up. */}
              <p className="mt-4 border-t border-signal/15 pt-3 text-center font-mono text-[9px] leading-relaxed tracking-[0.15em] text-alert/50">
                DEMO UPLINK — NO ACCOUNTS EXIST YET. NOTHING IS TRANSMITTED OR
                STORED.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

function Field({
  id,
  errorId,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  errorId: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p
          id={errorId}
          className="mt-1.5 font-mono text-[10px] tracking-wide text-alert-soft"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 font-mono text-[10px] tracking-wide text-signal/25">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
