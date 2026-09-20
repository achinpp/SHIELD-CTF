"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";

import { shell } from "@/app/actions/workstation";
import {
  SHELL_BANNER,
  SHELL_HOME,
  type ShellBlock,
  type ShellResult,
} from "@/lib/workstation-format";

/**
 * The stage-04 evidence terminal.
 *
 * SHIELD-WKS-006 shipped as an interactive Docker box. This is the same
 * investigation without the container: every command is a round trip to a
 * server action that reads a frozen disk image, so nothing is executed and
 * nothing is downloaded.
 *
 * It imports its types from `workstation-format`, not `workstation` — the
 * latter is `server-only` and reading a runtime value from it here would ship
 * the disk image, flag included, straight to the browser.
 */

/** What the transcript holds: an echoed prompt, or a server result block. */
type Line =
  | { kind: "prompt"; cwd: string; text: string }
  | { kind: "block"; block: ShellBlock };

const TONE: Record<"info" | "warn" | "error", string> = {
  info: "text-signal/55",
  warn: "text-amber-300/70",
  error: "text-alert-soft",
};

/** `~` for the agent's own home, the way a real prompt shortens it. */
function shorten(cwd: string): string {
  if (cwd === SHELL_HOME) return "~";
  return cwd.startsWith(`${SHELL_HOME}/`) ? `~${cwd.slice(SHELL_HOME.length)}` : cwd;
}

export function WorkstationConsole({ slug }: { slug: string }) {
  const ids = useId();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState(SHELL_HOME);
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

      if (command === "clear") {
        setLines([]);
        return;
      }

      setLines((prev) => [...prev, { kind: "prompt", cwd, text: command }]);

      startTransition(async () => {
        let result: ShellResult;
        try {
          result = await shell(slug, cwd, command);
        } catch {
          result = {
            blocks: [
              {
                kind: "note",
                tone: "error",
                lines: ["the evidence package did not answer. Try again."],
              },
            ],
            cwd,
          };
        }
        setCwd(result.cwd);
        setLines((prev) => [
          ...prev,
          ...result.blocks.map((block) => ({ kind: "block" as const, block })),
        ]);
      });
    },
    [slug, cwd],
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

  const prompt = `agent006@SHIELD-WKS-006:${shorten(cwd)}$`;

  return (
    <div className="mt-3 border border-signal/25 bg-void/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-signal/15 bg-signal/[0.04] px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-signal/50">
          SHIELD-WKS-006 · READ-ONLY IMAGE
        </span>
        <span className="font-mono text-[10px] tracking-[0.15em] text-signal/30">
          CASE 006-17
        </span>
      </div>

      <div
        ref={scroller}
        // Clicking anywhere in the transcript should land in the prompt, the
        // way clicking a terminal does.
        onMouseUp={() => {
          if (!window.getSelection()?.toString()) field.current?.focus();
        }}
        className="h-[28rem] overflow-y-auto overflow-x-auto px-3 py-3 font-mono text-[11.5px] leading-relaxed"
      >
        <div className="text-signal/40">
          {SHELL_BANNER.map((line, i) => (
            <p key={i} className="whitespace-pre">
              {line || " "}
            </p>
          ))}
        </div>

        {lines.map((line, i) =>
          line.kind === "prompt" ? (
            <p key={i} className="mt-3 whitespace-pre-wrap text-signal">
              <span className="text-signal/35">
                agent006@SHIELD-WKS-006:{shorten(line.cwd)}${" "}
              </span>
              {line.text}
            </p>
          ) : (
            <Block key={i} block={line.block} />
          ),
        )}

        {pending && (
          <p className="mt-2 text-signal/30" aria-live="polite">
            reading…
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-signal/15 px-3 py-2.5">
        <label
          htmlFor={`${ids}-cmd`}
          aria-label="Workstation shell command"
          className="shrink-0 font-mono text-[11.5px] text-signal/35"
        >
          {prompt}
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

function Block({ block }: { block: ShellBlock }) {
  const tone = block.kind === "note" ? TONE[block.tone] : "text-signal/75";
  return (
    <div className={`mt-2 ${tone}`}>
      {block.lines.map((line, i) => (
        // `whitespace-pre-wrap` keeps `ls -l` columns aligned without letting a
        // long log line escape the panel.
        <p key={i} className="whitespace-pre-wrap">
          {line || " "}
        </p>
      ))}
    </div>
  );
}
