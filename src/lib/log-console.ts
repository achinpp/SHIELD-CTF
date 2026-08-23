import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  CONSOLE_HELP,
  type ConsoleBlock,
  type ConsoleResult,
} from "@/lib/log-console-format";

/**
 * The stage-03 log, queryable but not obtainable.
 *
 * The artifact used to be a static file under `public/`, which made the stage
 * a two-step exercise: download the log, paste it into a model, read the
 * answer back. Moving it under `data/` takes it off the web root — nothing
 * serves it, and the only way to read it is through the queries below.
 *
 * The caps are the whole point, so they are worth stating plainly:
 *
 *   - No query returns the record. The widest result is PAGE_LIMIT lines.
 *   - A raw-line query matching more than BROAD_MATCH lines is refused
 *     outright, so `filter status=4xx` cannot be walked page by page.
 *   - Every raw line returned is drawn against an hourly budget, so paging
 *     with `offset=` runs dry long before the file does.
 *   - Aggregates are free, because they are summaries. `count path` groups on
 *     the path with its query string removed, which is what keeps the
 *     exfiltration parameters from leaking through a query that costs nothing.
 *
 * What this is not: a guarantee. Anything rendered to a browser can be read
 * out of that browser. This makes draining the record cost hours of scripted
 * paging instead of one download, which is enough to make solving the stage
 * the cheaper path — that is the bar, not secrecy.
 */

// ── Caps ────────────────────────────────────────────────────────────────
/** Most raw lines any single command will return. */
const PAGE_LIMIT = 40;
/** A raw-line query matching more than this is refused, not paged. */
const BROAD_MATCH = 300;
/** `head`/`tail` are deliberately smaller than a filtered page. */
const HEAD_TAIL_MAX = 25;
/** Rows in a tally, before it is truncated. */
const TALLY_ROWS = 12;
/** Raw lines one agent may read per rolling hour. */
const HOURLY_BUDGET = 750;
const BUDGET_WINDOW_MS = 60 * 60 * 1000;
/** Commands per rolling minute, so the console cannot be hammered. */
const COMMANDS_PER_MINUTE = 40;
const COMMAND_WINDOW_MS = 60 * 1000;

// ── The record ──────────────────────────────────────────────────────────

type Entry = {
  /** 1-based position in the file, shown so results can be cited. */
  n: number;
  ip: string;
  time: string;
  method: string;
  /** Request target, query string included. */
  path: string;
  /** Request target with the query string removed; what `count path` groups on. */
  route: string;
  status: string;
  bytes: string;
  ua: string;
  raw: string;
};

const LINE =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d{3}) (\d+) "([^"]*)" "([^"]*)"$/;

/**
 * Which file backs which stage, relative to ARTIFACTS. A slug with no entry
 * has no console.
 *
 * Split from the directory rather than held as one whole path because the
 * build traces filesystem access statically: a `path.join(cwd(), variable)`
 * it cannot resolve makes it give up and trace the entire project into the
 * server bundle. Keeping the root a literal is what scopes that to `data/`.
 */
const ARTIFACTS = "data/challenges";
const SOURCES: Record<string, string> = {
  "stage-03": "stage-03/access.log",
};

function hasConsole(slug: string): boolean {
  return slug in SOURCES;
}

/**
 * Parsed once per process, on first query.
 *
 * Held as the promise rather than the result so concurrent first calls share
 * one read instead of racing to parse a megabyte each. The file is read from
 * `process.cwd()`; `outputFileTracingIncludes` in `next.config.ts` is what
 * carries it into the standalone build, since nothing imports it.
 */
const records = new Map<string, Promise<Entry[]>>();

function load(slug: string): Promise<Entry[]> {
  const cached = records.get(slug);
  if (cached) return cached;

  const parsing = readFile(
    path.join(process.cwd(), ARTIFACTS, SOURCES[slug]),
    "utf8",
  ).then((text) => {
    const entries: Entry[] = [];
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trimEnd();
      const m = LINE.exec(raw);
      if (!m) continue;
      const [, ip, time, method, target, status, bytes, , ua] = m;
      entries.push({
        n: i + 1,
        ip,
        time,
        method,
        path: target,
        route: target.split("?")[0],
        status,
        bytes,
        ua,
        raw,
      });
    }
    return entries;
  });

  records.set(slug, parsing);
  return parsing;
}

// ── Budgets ─────────────────────────────────────────────────────────────

/**
 * Per-agent spend, in this process only.
 *
 * Deliberately not in Postgres, unlike the login and flag throttles. Those
 * defend the account; this one defends a puzzle, and losing its state on
 * restart costs a player one extra hour of budget rather than costing anyone
 * their security. It is also the reason a multi-replica deploy would multiply
 * the budget by the replica count — this platform runs one container.
 */
type Spend = { at: number; lines: number };
const spend = new Map<string, Spend[]>();

/**
 * Drop entries past the hour and hand back what is left.
 *
 * Pruning happens against the *longest* window only. Pruning to the
 * one-minute command window here instead would throw away the rest of the
 * hour's spend, and the read budget would reset every minute.
 */
function history(userId: string): Spend[] {
  const cutoff = Date.now() - BUDGET_WINDOW_MS;
  const kept = (spend.get(userId) ?? []).filter((s) => s.at > cutoff);
  spend.set(userId, kept);
  return kept;
}

function budgetLeft(userId: string): number {
  const used = history(userId).reduce((n, s) => n + s.lines, 0);
  return Math.max(0, HOURLY_BUDGET - used);
}

/** Commands issued in the last minute, counted off the same history. */
function commandsThisMinute(userId: string): number {
  const cutoff = Date.now() - COMMAND_WINDOW_MS;
  return history(userId).filter((s) => s.at > cutoff).length;
}

function charge(userId: string, lines: number): void {
  history(userId).push({ at: Date.now(), lines });
}

// ── Query parsing ───────────────────────────────────────────────────────

type Terms = {
  ip?: string;
  status?: string;
  method?: string;
  pathPart?: string;
  uaPart?: string;
  text?: string;
  limit: number;
  offset: number;
};

const FIELDS = new Set(["ip", "status", "method", "path", "ua"]);

function note(
  tone: "info" | "warn" | "error",
  ...lines: string[]
): ConsoleBlock {
  return { kind: "note", tone, lines };
}

/** Pull `limit=`/`offset=` and the field terms out of a token list. */
function readTerms(tokens: string[]): Terms | string {
  const terms: Terms = { limit: PAGE_LIMIT, offset: 0 };

  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq < 1) return `unrecognised term \`${token}\` — expected field=value`;

    const key = token.slice(0, eq).toLowerCase();
    const value = token.slice(eq + 1);
    if (!value) return `\`${key}=\` needs a value`;

    switch (key) {
      case "ip":
        terms.ip = value;
        break;
      case "status":
        if (!/^[1-5](\d{2}|xx)$/i.test(value)) {
          return "status takes a code like `404` or a class like `4xx`";
        }
        terms.status = value.toLowerCase();
        break;
      case "method":
        terms.method = value.toUpperCase();
        break;
      case "path":
        terms.pathPart = value.toLowerCase();
        break;
      case "ua":
        terms.uaPart = value.toLowerCase();
        break;
      case "limit": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) return "limit takes a positive whole number";
        terms.limit = Math.min(n, PAGE_LIMIT);
        break;
      }
      case "offset": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0) return "offset takes a whole number";
        terms.offset = n;
        break;
      }
      default:
        return `unknown field \`${key}\` — try ${[...FIELDS].join(", ")}`;
    }
  }

  return terms;
}

function matches(e: Entry, t: Terms): boolean {
  if (t.ip && e.ip !== t.ip) return false;
  if (t.method && e.method !== t.method) return false;
  if (t.status) {
    if (t.status.endsWith("xx")) {
      if (e.status[0] !== t.status[0]) return false;
    } else if (e.status !== t.status) return false;
  }
  if (t.pathPart && !e.path.toLowerCase().includes(t.pathPart)) return false;
  if (t.uaPart && !e.ua.toLowerCase().includes(t.uaPart)) return false;
  if (t.text && !e.raw.toLowerCase().includes(t.text)) return false;
  return true;
}

// ── Result builders ─────────────────────────────────────────────────────

/**
 * Turn a match set into rows, charging the budget for what it hands over.
 *
 * Both walls live here so no command can route around one of them: the
 * breadth refusal above BROAD_MATCH, and the hourly budget. A refusal still
 * reports the match count, because the count is an analytic result — knowing
 * that 390 requests 404'd is the finding, and it costs nothing to give.
 */
function page(
  userId: string,
  hits: Entry[],
  t: Terms,
  describe: string,
): ConsoleBlock[] {
  if (hits.length === 0) {
    return [note("warn", `no lines match ${describe}.`)];
  }

  if (hits.length > BROAD_MATCH) {
    return [
      note(
        "warn",
        `${hits.length.toLocaleString()} lines match ${describe}.`,
        `That is past the ${BROAD_MATCH}-line read limit, so the terminal will not print them.`,
        "Narrow the filter, or aggregate instead — `count ip`, `count status`, `count path`.",
      ),
    ];
  }

  const left = budgetLeft(userId);
  if (left <= 0) {
    return [
      note(
        "error",
        "hourly read budget spent.",
        `The terminal releases ${HOURLY_BUDGET} lines an hour. Aggregates stay available.`,
      ),
    ];
  }

  const window = hits.slice(t.offset, t.offset + t.limit);
  if (window.length === 0) {
    return [
      note("warn", `offset ${t.offset} is past the end of ${hits.length} matches.`),
    ];
  }

  const rows = window.slice(0, left);
  charge(userId, rows.length);

  const blocks: ConsoleBlock[] = [
    note(
      "info",
      `${hits.length.toLocaleString()} lines match ${describe} — showing ${rows.length}` +
        (t.offset ? ` from offset ${t.offset}` : ""),
    ),
    { kind: "rows", rows: rows.map((e) => ({ n: e.n, text: e.raw })) },
  ];

  if (rows.length < window.length) {
    blocks.push(
      note("warn", "hourly read budget reached mid-page; the rest is withheld."),
    );
  } else if (t.offset + rows.length < hits.length) {
    blocks.push(
      note(
        "info",
        `more matches follow — repeat with offset=${t.offset + rows.length}.`,
      ),
    );
  }

  return blocks;
}

/** Aggregations are free: they summarise the record rather than release it. */
function tally(hits: Entry[], field: string, describe: string): ConsoleBlock[] {
  const pick = (e: Entry): string => {
    switch (field) {
      case "ip":
        return e.ip;
      case "status":
        return e.status;
      case "method":
        return e.method;
      // The query string is dropped on purpose. It is the one place the
      // exfiltrated parameters would surface in a result that costs no
      // budget, which would hand over the payload for free.
      case "path":
        return e.route;
      default:
        return e.ua;
    }
  };

  const counts = new Map<string, number>();
  for (const e of hits) {
    const key = pick(e);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  if (counts.size === 0) return [note("warn", `no lines match ${describe}.`)];

  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked.slice(0, TALLY_ROWS);
  const max = top[0][1];

  const blocks: ConsoleBlock[] = [
    {
      kind: "tally",
      title: `${field} × ${describe} — ${hits.length.toLocaleString()} lines, ${counts.size} distinct`,
      rows: top.map(([label, n]) => ({ label, n, share: n / max })),
    },
  ];

  if (ranked.length > top.length) {
    blocks.push(
      note("info", `${ranked.length - top.length} further values not shown.`),
    );
  }

  return blocks;
}

// ── Dispatch ────────────────────────────────────────────────────────────

/**
 * Run one console command for one agent.
 *
 * Every argument here is caller-supplied — this is reached through a Server
 * Action, which is a public POST endpoint — so the slug is checked against
 * SOURCES and the command is parsed rather than interpreted.
 */
export async function runCommand(
  userId: string,
  slug: string,
  input: string,
): Promise<ConsoleResult> {
  const done = (...blocks: ConsoleBlock[]): ConsoleResult => ({
    blocks,
    budgetLeft: budgetLeft(userId),
  });

  if (!hasConsole(slug)) {
    return done(note("error", "no record is mounted for this stage."));
  }

  if (commandsThisMinute(userId) >= COMMANDS_PER_MINUTE) {
    return done(note("error", "too many commands. Wait a minute."));
  }
  // Charged at zero lines so the command itself is counted for the rate
  // limit above without touching the hourly read budget.
  charge(userId, 0);

  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return done();

  const verb = tokens[0].toLowerCase();
  const rest = tokens.slice(1);
  const entries = await load(slug);

  switch (verb) {
    case "help":
    case "?":
      return done(note("info", ...CONSOLE_HELP));

    case "clear":
      return done();

    case "stat": {
      const ips = new Set(entries.map((e) => e.ip));
      const first = entries[0];
      const last = entries[entries.length - 1];
      return done(
        note(
          "info",
          `record      access.log — combined log format`,
          `lines       ${entries.length.toLocaleString()}`,
          `clients     ${ips.size} distinct addresses`,
          `window      ${first.time}`,
          `            ${last.time}`,
          `read budget ${budgetLeft(userId)} of ${HOURLY_BUDGET} lines left this hour`,
        ),
      );
    }

    case "head":
    case "tail": {
      const n = rest.length ? Number(rest[0]) : 10;
      if (!Number.isInteger(n) || n < 1) {
        return done(note("error", `${verb} takes a positive whole number.`));
      }
      const count = Math.min(n, HEAD_TAIL_MAX);
      const slice =
        verb === "head" ? entries.slice(0, count) : entries.slice(-count);
      return done(
        ...page(
          userId,
          slice,
          { limit: PAGE_LIMIT, offset: 0 },
          `${verb} ${count}`,
        ),
      );
    }

    case "grep": {
      // Everything up to the first `key=value` is the pattern, so a search
      // for a phrase does not have to be quoted. Only the known keys count as
      // a term — `grep seg=` is the natural way to hunt a query parameter, and
      // treating any `word=` as a filter would swallow the pattern instead.
      const split = rest.findIndex((t) =>
        /^(ip|status|method|path|ua|limit|offset)=/i.test(t),
      );
      const patternTokens = split === -1 ? rest : rest.slice(0, split);
      const termTokens = split === -1 ? [] : rest.slice(split);

      if (patternTokens.length === 0) {
        return done(note("error", "grep needs something to look for."));
      }
      const pattern = patternTokens.join(" ");
      if (pattern.length < 3) {
        return done(
          note(
            "error",
            "grep needs at least three characters — a shorter pattern matches most of the record.",
          ),
        );
      }

      const terms = readTerms(termTokens);
      if (typeof terms === "string") return done(note("error", terms));
      terms.text = pattern.toLowerCase();

      const hits = entries.filter((e) => matches(e, terms));
      return done(...page(userId, hits, terms, `"${pattern}"`));
    }

    case "filter": {
      if (rest.length === 0) {
        return done(note("error", "filter needs at least one field=value term."));
      }
      const terms = readTerms(rest);
      if (typeof terms === "string") return done(note("error", terms));

      const hits = entries.filter((e) => matches(e, terms));
      return done(...page(userId, hits, terms, rest.join(" ")));
    }

    case "count": {
      const field = (rest[0] ?? "").toLowerCase();
      if (!FIELDS.has(field)) {
        return done(
          note("error", `count takes one of: ${[...FIELDS].join(", ")}`),
        );
      }
      const terms = readTerms(rest.slice(1));
      if (typeof terms === "string") return done(note("error", terms));

      const hits = entries.filter((e) => matches(e, terms));
      const describe = rest.length > 1 ? rest.slice(1).join(" ") : "all lines";
      return done(...tally(hits, field, describe));
    }

    default:
      return done(
        note("error", `unknown command \`${verb}\`.`, "", ...CONSOLE_HELP),
      );
  }
}
