/**
 * The parts of the stage-04 workstation console that are safe in a browser
 * bundle.
 *
 * Separate from `@/lib/workstation`, which is `server-only` because it holds
 * the disk image — including the file the whole stage is looking for. The
 * console is a Client Component and needs the result shape to render it;
 * importing a runtime value from the server module would ship the workstation,
 * flag and all, to the browser.
 *
 * Nothing off that disk belongs in this file.
 */

/** Printed once, before the first prompt. Matches the box's own `/etc/motd`. */
export const SHELL_BANNER = [
  "SHIELD // SECURE EVIDENCE PACKAGE",
  "",
  "CASE: 006-17",
  "HOST: SHIELD-WKS-006",
  "",
  "[+] Authentication logs",
  "[+] Shell history",
  "[+] Hidden files",
  "[+] System artifacts",
  "",
  "Evidence loaded.",
  "",
  "Find out what happened.",
  "",
  "Type `help` for the tools on this image.",
] as const;

/** One rendered block. `kind` picks the styling, not the meaning. */
export type ShellBlock =
  /** Ordinary command output, monospaced and printed as-is. */
  | { kind: "out"; lines: string[] }
  /** Shell diagnostics: errors, notes, the help text. */
  | { kind: "note"; tone: "info" | "warn" | "error"; lines: string[] };

export type ShellResult = {
  blocks: ShellBlock[];
  /** Where the shell ended up, so the prompt can follow `cd`. */
  cwd: string;
};

/** The home directory the session opens in. */
export const SHELL_HOME = "/home/agent006";

/** Printed by `help`. */
export const SHELL_HELP = [
  "This is a read-only image of SHIELD-WKS-006. Standard investigation",
  "tools only — nothing on this disk can be modified or executed.",
  "",
  "  pwd                      where you are",
  "  cd <dir>                 move about; `cd` alone returns home",
  "  ls [-a] [-l] [path]      list a directory  (-a shows dotfiles)",
  "  cat <file>...            print a file",
  "  head [-n N] <file>       first N lines     (default 10)",
  "  tail [-n N] <file>       last N lines      (default 10)",
  "  grep [-i] <text> <file>  lines containing <text>",
  "  find [path] [-name pat] [-type f|d]",
  "  whoami / id / hostname / uname [-a]",
  "  submit_flag [token]      verify a token against the case digest",
  "  clear                    clear the transcript",
  "",
  "`ll` is aliased to `ls -la`, as it is in the agent's .bashrc.",
  "",
  "Hidden files are hidden, not absent. -a is your friend.",
] as const;
