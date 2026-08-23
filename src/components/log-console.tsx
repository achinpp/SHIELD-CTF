"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { query } from "@/app/actions/logs";
import {
  CONSOLE_BANNER,
  type ConsoleBlock,
  type ConsoleResult,
} from "@/lib/log-console-format";

/**
 * The stage-03 evidence terminal.
 *
 * Replaces what used to be a download link. Nothing here holds the log: every
 * command is a round trip, and the server decides how much of the record it is
 * willing to part with. The component's only job is making a capped view of a
 * large file feel like a tool rather than a restriction.
 *
 * It imports its types from `log-console-format`, not `log-console` — the
 * latter is `server-only` and reading a runtime value from it here would ship
 * the artifact to the browser.
 */

/** What the transcript holds: an echoed prompt, or a server result block. */
type Line =
  | { kind: "prompt"; text: string }
  | { kind: "block"; block: ConsoleBlock };

const TONE: Record<"info" | "warn" | "error", string> = {
  info: "text-signal/55",
  warn: "text-amber-300/70",
  error: "text-alert-soft",
};

/**
 * A selection this size is note-taking; anything larger is a transcript grab.
 * Cheap friction against select-all-and-paste, and nothing more than that —
 * the same text is in the network response, one devtools panel away.
 */
const COPY_LINE_LIMIT = 5;

export function LogConsole({ slug }: { slug: string }) {
  const ids = useId();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Past commands, newest last; `cursor` is where arrow-key recall sits.
  const past = useRef<string[]>([]);
  const cursor = useRef<number>(-1);

  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // Follow the tail as output arrives, the way a terminal does.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, pending]);

  const run = useCallback(
    (raw: string) => {
      const command = raw.trim();
      if (!command) return;

      past.current.push(command);
      cursor.current = -1;
      setInput("");

      if (command.toLowerCase() === "clear") {
        setLines([]);
        return;
      }

      setLines((prev) => [...prev, { kind: "prompt", text: command }]);

      startTransition(async () => {
        let result: ConsoleResult;
        try {
          result = await query(slug, command);
        } catch {
          result = {
            blocks: [
              {
                kind: "note",
                tone: "error",
                lines: ["the archive did not answer. Try again."],
              },
            ],
            budgetLeft: 0,
          };
        }
        setBudget(result.budgetLeft);
        setLines((prev) => [
          ...prev,
          ...result.blocks.map((block) => ({ kind: "block" as const, block })),
        ]);
      });
    },
    [slug],
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      run(input);
      return;
    }
    // Arrow-key history, counted back from the most recent command.
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (past.current.length === 0) return;
      e.preventDefault();
      const next =
        e.key === "ArrowUp"
          ? Math.min(cursor.current + 1, past.current.length - 1)
          : cursor.current - 1;
      cursor.current = Math.max(next, -1);
      setInput(
        cursor.current === -1
          ? ""
          : past.current[past.current.length - 1 - cursor.current],
      );
    }
  }

  function onCopy(e: ClipboardEvent<HTMLDivElement>) {
    const selected = window.getSelection()?.toString() ?? "";
    if (selected.split("\n").filter(Boolean).length > COPY_LINE_LIMIT) {
      e.preventDefault();
      setLines((prev) => [
        ...prev,
        {
          kind: "block",
          block: {
            kind: "note",
            tone: "warn",
            lines: [
              "bulk copy blocked — the record is not exportable.",
              "Read it here, or narrow the query until the answer is a line you can carry out yourself.",
            ],
          },
        },
      ]);
    }
  }

  return (
    <div className="mt-3 border border-signal/25 bg-void/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-signal/15 bg-signal/[0.04] px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-signal/50">
          access.log · READ-ONLY
        </span>
        <span className="font-mono text-[10px] tracking-[0.15em] text-signal/30">
          {budget === null ? "4,678 LINES" : `${budget} LINE READS LEFT THIS HOUR`}
        </span>
      </div>

      <div
        ref={scroller}
        onCopy={onCopy}
        // Clicking anywhere in the transcript should land in the prompt, the
        // way clicking a terminal does.
        onMouseUp={() => {
          if (!window.getSelection()?.toString()) field.current?.focus();
        }}
        className="h-[26rem] overflow-y-auto overflow-x-auto px-3 py-3 font-mono text-[11.5px] leading-relaxed"
      >
        <div className="text-signal/40">
          {CONSOLE_BANNER.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        {lines.map((line, i) =>
          line.kind === "prompt" ? (
            <p key={i} className="mt-3 whitespace-pre text-signal">
              <span className="text-signal/35">shield@archive:~$ </span>
              {line.text}
            </p>
          ) : (
            <Block key={i} block={line.block} />
          ),
        )}

        {pending && (
          <p className="mt-2 text-signal/30" aria-live="polite">
            querying…
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-signal/15 px-3 py-2.5">
        <label
          htmlFor={`${ids}-cmd`}
          aria-label="Log query command"
          className="font-mono text-[11.5px] text-signal/35"
        >
          shield@archive:~$
        </label>
        <input
          id={`${ids}-cmd`}
          ref={field}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={pending}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="help"
          className="min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-signal outline-none placeholder:text-signal/20 disabled:opacity-50"
        />
      </div>
    </div>
  );
}

function Block({ block }: { block: ConsoleBlock }) {
  if (block.kind === "note") {
    return (
      <div className={`mt-2 ${TONE[block.tone]}`}>
        {block.lines.map((line, i) => (
          // `whitespace-pre-wrap` keeps the column alignment in `stat` and
          // `help` without letting a long line escape the panel.
          <p key={i} className="whitespace-pre-wrap">
            {line || " "}
          </p>
        ))}
      </div>
    );
  }

  if (block.kind === "rows") {
    return (
      <div className="mt-2 space-y-0.5">
        {block.rows.map((row) => (
          <p key={row.n} className="whitespace-pre text-signal/75">
            <span className="select-none text-signal/25">
              {String(row.n).padStart(5, " ")}{"  "}
            </span>
            {row.text}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-signal/40">{block.title}</p>
      <div className="mt-1 space-y-0.5">
        {block.rows.map((row) => (
          <p key={row.label} className="flex items-baseline gap-2 whitespace-pre">
            <span className="w-14 shrink-0 text-right text-signal">
              {row.n.toLocaleString()}
            </span>
            <span
              aria-hidden
              // A bar rather than a number alone: the whole stage turns on
              // noticing that one client's shape is unlike the rest.
              className="hidden h-2 shrink-0 bg-signal/30 sm:block"
              style={{ width: `${Math.max(row.share * 8, 0.35)}rem` }}
            />
            <span className="min-w-0 text-signal/70">{row.label}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
