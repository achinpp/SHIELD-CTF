/**
 * The parts of the log console that are safe in a browser bundle.
 *
 * Separate from `@/lib/log-console`, which is `server-only` because it holds
 * the log itself. The console is a Client Component and needs the result
 * shape to render it; importing a runtime value from the server module would
 * pull the whole 4,678-line artifact into the browser bundle — which is the
 * one thing this whole feature exists to prevent.
 *
 * Nothing from the log belongs in this file.
 */

/** The banner the console prints before the first prompt. */
export const CONSOLE_BANNER = [
  "S.H.I.E.L.D. ARCHIVE — LOG QUERY TERMINAL",
  "Read-only. The record cannot be exported.",
  "Type `help` for the command list.",
] as const;

/** One rendered result block. `kind` picks the styling, not the meaning. */
export type ConsoleBlock =
  /** Free text: banners, help, errors, counts-without-rows. */
  | { kind: "note"; tone: "info" | "warn" | "error"; lines: string[] }
  /** Raw log lines, monospaced and numbered by their position in the file. */
  | { kind: "rows"; rows: { n: number; text: string }[] }
  /** An aggregation: label, count, and a bar width as a 0-1 fraction. */
  | { kind: "tally"; title: string; rows: { label: string; n: number; share: number }[] };

export type ConsoleResult = {
  blocks: ConsoleBlock[];
  /** Raw log lines still readable this hour, after this command. */
  budgetLeft: number;
};

/** Printed by `help`, and by any command that arrives malformed. */
export const CONSOLE_HELP = [
  "stat                        summary of the record",
  "head [n]                    first n lines            (n <= 25)",
  "tail [n]                    last n lines             (n <= 25)",
  "grep <text>                 lines containing <text>",
  "filter <field>=<value> ...  lines matching every term",
  "count <field> [filters]     tally one field, ranked",
  "",
  "fields   ip  status  method  path  ua",
  "         status takes 404 or 4xx; path and ua match on substring",
  "extras   limit=<n>  offset=<n>   page through a result set",
  "",
  "examples",
  "  count ip",
  "  count ip status=4xx",
  "  filter ip=10.17.146.212 status=200 limit=20",
  "  grep legacy-export",
] as const;
