import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import {
  SHELL_HELP,
  SHELL_HOME,
  type ShellBlock,
  type ShellResult,
} from "@/lib/workstation-format";

/**
 * The stage-04 workstation: a read-only disk image and a shell over it.
 *
 * SHIELD-WKS-006 shipped as a Docker box with an interactive TTY. That cannot
 * be a page, so what is modelled here is the *other* thing it shipped with —
 * the launcher's simulated shell, which walked a fixed directory tree and
 * implemented a handful of investigation commands. This is that, server-side,
 * with the tree in `data/challenges/stage-04/workstation.json`.
 *
 * Nothing here executes anything. Every command is a lookup against a frozen
 * JSON tree, so there is no process, no writable path and no way for a typed
 * string to become behaviour — which is the whole reason a privilege-
 * escalation stage can sit safely inside the scoring service.
 *
 * The stage is a *reading* exercise anyway: the box was never solved by
 * running something, but by correlating auth.log, two shell histories, a
 * sudoers drop-in and a hidden note. All of that survives the translation.
 *
 * Root kept as a literal for the same reason as in `@/lib/evidence`: the build
 * traces filesystem access statically, and a `path.join` it cannot resolve
 * makes it trace the whole project into the server bundle.
 */
const IMAGE = "data/challenges/stage-04/workstation.json";

type Node = {
  type: "dir" | "file";
  mode: string;
  owner: string;
  group: string;
  mtime: string;
  size: number;
  content?: string;
  /** `base64` when the content is held encoded at rest. */
  encoding?: "base64";
};

type Image = {
  host: string;
  user: string;
  home: string;
  nodes: Record<string, Node>;
};

/**
 * Read once per request pass. The image is small and never changes, so this is
 * about not re-parsing it for every command in a render, not about caching
 * across requests.
 */
const loadImage = cache(async (): Promise<Image> => {
  const raw = await readFile(path.join(process.cwd(), IMAGE), "utf8");
  return JSON.parse(raw) as Image;
});

/**
 * A file's bytes as the shell should print them.
 *
 * `.doorway` is held base64 in the JSON so that a grep of this repository does
 * not turn up the flag — the same discipline as the seed storing a digest
 * rather than a string. Decoding happens here, at the moment an agent actually
 * reads the file, which is exactly when they have earned it.
 */
function contentOf(node: Node): string {
  if (!node.content) return "";
  return node.encoding === "base64"
    ? Buffer.from(node.content, "base64").toString("utf8")
    : node.content;
}

/** Split a file into printable lines, dropping the trailing empty one. */
function linesOf(node: Node): string[] {
  const text = contentOf(node);
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Resolve `arg` against `cwd` into a normalised absolute path. */
function resolvePath(cwd: string, arg: string): string {
  let target = arg.trim();
  if (target === "~" || target === "") target = SHELL_HOME;
  else if (target.startsWith("~/")) target = SHELL_HOME + target.slice(1);

  const parts = (target.startsWith("/") ? target : `${cwd}/${target}`).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return `/${stack.join("/")}`;
}

/** Immediate children of a directory path. */
function childrenOf(image: Image, dir: string): string[] {
  const prefix = dir === "/" ? "/" : `${dir}/`;
  return Object.keys(image.nodes).filter((p) => {
    if (p === dir || !p.startsWith(prefix)) return false;
    return !p.slice(prefix.length).includes("/");
  });
}

const basename = (p: string) => (p === "/" ? "/" : p.slice(p.lastIndexOf("/") + 1));

/** Everything at or under `root`, in path order. */
function walk(image: Image, root: string): string[] {
  const prefix = root === "/" ? "/" : `${root}/`;
  return Object.keys(image.nodes)
    .filter((p) => p === root || p.startsWith(prefix))
    .sort();
}

/** `ls -l` row for one node. */
function longRow(image: Image, p: string, node: Node, name: string): string {
  const links =
    node.type === "dir"
      ? 2 + childrenOf(image, p).filter((c) => image.nodes[c].type === "dir").length
      : 1;
  return [
    node.mode,
    String(links),
    node.owner.padEnd(11),
    node.group.padEnd(11),
    String(node.size).padStart(6),
    node.mtime,
    name,
  ].join(" ");
}

const out = (lines: string[]): ShellBlock => ({ kind: "out", lines });
const err = (line: string): ShellBlock => ({
  kind: "note",
  tone: "error",
  lines: [line],
});

/** Longer than any real listing here; stops a pathological find flooding the page. */
const MAX_OUTPUT_LINES = 400;

function capped(lines: string[]): ShellBlock[] {
  if (lines.length <= MAX_OUTPUT_LINES) return [out(lines)];
  return [
    out(lines.slice(0, MAX_OUTPUT_LINES)),
    {
      kind: "note",
      tone: "warn",
      lines: [`… output truncated at ${MAX_OUTPUT_LINES} lines. Narrow the path.`],
    },
  ];
}

/**
 * Tokenise a command line, honouring single and double quotes so that
 * `grep "Accepted publickey" file` behaves the way it reads.
 */
function tokenise(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let has = false;

  for (const ch of input) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current || has) tokens.push(current);
      current = "";
      has = false;
      continue;
    }
    current += ch;
  }
  if (current || has) tokens.push(current);
  return tokens;
}

/** Pull `-n N` (or `-N`) out of the arguments, returning the count and the rest. */
function takeCount(args: string[], fallback: number): [number, string[]] {
  const rest: string[] = [];
  let n = fallback;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-n" && i + 1 < args.length) {
      const parsed = Number.parseInt(args[++i], 10);
      if (Number.isFinite(parsed)) n = parsed;
    } else if (/^-\d+$/.test(a)) {
      n = Number.parseInt(a.slice(1), 10);
    } else {
      rest.push(a);
    }
  }
  return [Math.max(0, n), rest];
}

/**
 * Run one command line against the image.
 *
 * `cwd` arrives from the client, which is fine: it is re-resolved against the
 * image on every call and a path that is not a directory in the tree is simply
 * rejected, so the worst a tampered value can do is list a directory the agent
 * could have reached by typing `cd`.
 */
export async function runShell(cwdIn: string, input: string): Promise<ShellResult> {
  const image = await loadImage();

  // Re-validate the incoming directory rather than trusting it.
  let cwd =
    image.nodes[cwdIn]?.type === "dir" ? cwdIn : SHELL_HOME;

  const tokens = tokenise(input.trim());
  if (tokens.length === 0) return { blocks: [], cwd };

  // `ll` is the alias the agent's own .bashrc defines.
  const raw = tokens[0];
  const cmd = raw === "ll" ? "ls" : raw;
  const args = raw === "ll" ? ["-la", ...tokens.slice(1)] : tokens.slice(1);
  const flags = args.filter((a) => a.startsWith("-"));
  const operands = args.filter((a) => !a.startsWith("-"));
  const hasFlag = (letter: string) =>
    flags.some((f) => !f.startsWith("--") && f.includes(letter));

  const blocks: ShellBlock[] = [];

  switch (cmd) {
    case "help":
    case "?":
      blocks.push({ kind: "note", tone: "info", lines: [...SHELL_HELP] });
      break;

    case "pwd":
      blocks.push(out([cwd]));
      break;

    case "whoami":
      blocks.push(out([image.user]));
      break;

    case "id":
      blocks.push(
        out([`uid=1001(${image.user}) gid=1001(${image.user}) groups=1001(${image.user})`]),
      );
      break;

    case "hostname":
      blocks.push(out([image.host]));
      break;

    case "uname":
      blocks.push(
        out([
          hasFlag("a")
            ? `Linux ${image.host} 5.15.0-118-generic #128-Ubuntu SMP x86_64 GNU/Linux`
            : "Linux",
        ]),
      );
      break;

    case "cd": {
      const target = resolvePath(cwd, operands[0] ?? SHELL_HOME);
      const node = image.nodes[target];
      if (!node) blocks.push(err(`bash: cd: ${operands[0] ?? "~"}: No such file or directory`));
      else if (node.type !== "dir")
        blocks.push(err(`bash: cd: ${operands[0]}: Not a directory`));
      else cwd = target;
      break;
    }

    case "ls": {
      const targetArg = operands[0] ?? ".";
      const target = resolvePath(cwd, targetArg);
      const node = image.nodes[target];
      if (!node) {
        blocks.push(err(`ls: cannot access '${targetArg}': No such file or directory`));
        break;
      }

      const all = hasFlag("a");
      const long = hasFlag("l");

      if (node.type === "file") {
        blocks.push(out([long ? longRow(image, target, node, targetArg) : targetArg]));
        break;
      }

      let names = childrenOf(image, target)
        .map((p) => ({ p, name: basename(p) }))
        .filter(({ name }) => all || !name.startsWith("."))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (all) {
        // `.` and `..` come first, as they do in a real listing.
        const parent = target === "/" ? "/" : resolvePath(target, "..");
        names = [
          { p: target, name: "." },
          { p: image.nodes[parent] ? parent : target, name: ".." },
          ...names,
        ];
      }

      if (long) {
        blocks.push(
          ...capped([
            `total ${names.length * 4}`,
            ...names.map(({ p, name }) => longRow(image, p, image.nodes[p], name)),
          ]),
        );
      } else {
        blocks.push(out([names.map(({ name }) => name).join("  ")]));
      }
      break;
    }

    case "cat": {
      if (operands.length === 0) {
        blocks.push(err("cat: missing operand"));
        break;
      }
      for (const arg of operands) {
        const target = resolvePath(cwd, arg);
        const node = image.nodes[target];
        if (!node) blocks.push(err(`cat: ${arg}: No such file or directory`));
        else if (node.type === "dir") blocks.push(err(`cat: ${arg}: Is a directory`));
        else blocks.push(...capped(linesOf(node)));
      }
      break;
    }

    case "head":
    case "tail": {
      const [n, rest] = takeCount(args, 10);
      const arg = rest.find((a) => !a.startsWith("-"));
      if (!arg) {
        blocks.push(err(`${cmd}: missing operand`));
        break;
      }
      const target = resolvePath(cwd, arg);
      const node = image.nodes[target];
      if (!node || node.type !== "file") {
        blocks.push(err(`${cmd}: cannot open '${arg}' for reading: No such file or directory`));
        break;
      }
      const lines = linesOf(node);
      blocks.push(...capped(cmd === "head" ? lines.slice(0, n) : lines.slice(-n)));
      break;
    }

    case "grep": {
      // Deliberately single-file, like the image's own shell: no -r. A
      // recursive grep would let `grep -r SHIELD /` end the stage without any
      // of the correlation the stage is actually about.
      const insensitive = hasFlag("i");
      const [pattern, fileArg] = operands;
      if (!pattern || !fileArg) {
        blocks.push(err("usage: grep [-i] <text> <file>"));
        break;
      }
      const target = resolvePath(cwd, fileArg);
      const node = image.nodes[target];
      if (!node) {
        blocks.push(err(`grep: ${fileArg}: No such file or directory`));
        break;
      }
      if (node.type !== "file") {
        // Real grep says this, and says it instead of searching — which is
        // also what keeps `grep -r SHIELD /` from ending the stage outright.
        blocks.push(err(`grep: ${fileArg}: Is a directory`));
        break;
      }
      const needle = insensitive ? pattern.toLowerCase() : pattern;
      const hits = linesOf(node).filter((line) =>
        (insensitive ? line.toLowerCase() : line).includes(needle),
      );
      if (hits.length === 0) blocks.push({ kind: "note", tone: "info", lines: ["(no matches)"] });
      else blocks.push(...capped(hits));
      break;
    }

    case "find": {
      const start = resolvePath(cwd, operands[0] ?? ".");
      if (!image.nodes[start]) {
        blocks.push(err(`find: '${operands[0] ?? "."}': No such file or directory`));
        break;
      }
      const nameIdx = args.indexOf("-name");
      const pattern = nameIdx >= 0 ? args[nameIdx + 1] : undefined;
      const typeIdx = args.indexOf("-type");
      const wantType = typeIdx >= 0 ? args[typeIdx + 1] : undefined;

      // Only the glob features a `-name` argument actually uses here.
      const matches = (name: string) => {
        if (!pattern) return true;
        const rx = new RegExp(
          `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
        );
        return rx.test(name);
      };

      const found = walk(image, start).filter((p) => {
        const node = image.nodes[p];
        if (wantType === "f" && node.type !== "file") return false;
        if (wantType === "d" && node.type !== "dir") return false;
        return matches(basename(p));
      });
      blocks.push(...capped(found));
      break;
    }

    case "submit_flag":
    case "./submit_flag":
      // Deliberately does not verify. A verifier here would be an unthrottled
      // oracle sitting next to the real submission form, which is rate-limited
      // and is what actually scores the stage.
      blocks.push({
        kind: "note",
        tone: "info",
        lines: [
          "[*] This image is mounted read-only; its verifier cannot be executed.",
          "[*] File the token with SHIELD command — the submission panel below",
          "    this terminal is the only thing that closes a case.",
        ],
      });
      break;

    case "sudo":
      blocks.push(err(`sudo: a password is required for ${image.user} on this image`));
      break;

    case "exit":
    case "logout":
      blocks.push({
        kind: "note",
        tone: "info",
        lines: ["The image stays mounted. Close the stage page when you are done."],
      });
      break;

    default:
      blocks.push(
        err(`bash: ${cmd}: command not found (read-only image — try \`help\`)`),
      );
  }

  return { blocks, cwd };
}
