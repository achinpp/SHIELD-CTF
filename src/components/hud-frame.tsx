"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const CORNERS = [
  "left-0 top-0 border-l-2 border-t-2",
  "right-0 top-0 border-r-2 border-t-2",
  "left-0 bottom-0 border-l-2 border-b-2",
  "right-0 bottom-0 border-r-2 border-b-2",
] as const;

/** Rotating chatter. Flavour only — nothing here is a real hint. */
const INTERCEPTS = [
  "HYDRA CHATTER RISING",
  "TRACE PROTOCOL ARMED",
  "FIREWALL INTEGRITY 68%",
  "DECRYPT KEY UNRESOLVED",
  "12 VAULTS STILL SEALED",
] as const;

const DWELL_MS = 3200;

/** A slow ticker, so the terminal reads as live rather than a static poster. */
function InterceptFeed() {
  const prefersReduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReduced) return;
    const id = window.setInterval(
      () => setIndex((n) => (n + 1) % INTERCEPTS.length),
      DWELL_MS,
    );
    return () => window.clearInterval(id);
  }, [prefersReduced]);

  return (
    <span className="flex items-center gap-2">
      <span className="text-signal/30">INTERCEPT</span>
      <span className="relative block h-4 w-60 overflow-hidden leading-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={index}
            className="absolute inset-0 whitespace-nowrap"
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -7 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {INTERCEPTS[index]}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

/**
 * Terminal chrome drawn on the viewport edges, outside the art stage, so it
 * never crowds the composition regardless of aspect ratio.
 */
export function HudFrame() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-4 z-30 font-mono text-[10px] tracking-[0.16em] text-signal/55 sm:inset-6 sm:text-[11px] sm:tracking-[0.28em]"
    >
      {CORNERS.map((corner) => (
        <span
          key={corner}
          className={`absolute size-5 border-signal/35 sm:size-7 ${corner}`}
        />
      ))}

      <div className="absolute left-8 top-0 sm:left-11">
        S.H.I.E.L.D. <span className="text-signal/30">{"//"}</span> SECURE
        TERMINAL
      </div>

      {/* Dropped on narrow screens, where it would run into the title above. */}
      <div className="absolute right-8 top-0 hidden items-center gap-2 sm:right-11 sm:flex">
        <span className="size-1.5 rounded-full bg-alert shadow-[0_0_8px] shadow-alert" />
        LINK ENCRYPTED
      </div>

      <div className="absolute bottom-0 left-8 hidden sm:left-11 sm:block">
        <InterceptFeed />
      </div>

      <div className="absolute bottom-0 right-8 sm:right-11">
        AWAITING INPUT<span className="caret-blink ml-1 inline-block">_</span>
      </div>
    </div>
  );
}
