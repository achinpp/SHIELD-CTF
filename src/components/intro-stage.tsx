"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

import backdrop from "@/assets/background.png";
// Alpha-keyed plates generated from the flat source artwork by
// `npm run assets:prepare` — the originals have no alpha channel.
import crest from "@/assets/plates/crest.png";
import title from "@/assets/plates/title.png";
import subtitle from "@/assets/plates/subtitle.png";
import { AccessPanel } from "@/components/access-panel";
import { HudFrame } from "@/components/hud-frame";
import {
  APPROACH,
  CREST_START_SCALE,
  CUE,
  DURATION,
  IMPACT,
  INSTANT,
  SEQUENCE_END,
} from "@/lib/sequence";

/** Every plate is a full-frame 16:9 overlay, so they all fill the stage. */
const PLATE = "absolute inset-0 select-none object-contain";

/** Upper bound on the stage width — see `--stage-width` in globals.css. */
const PLATE_SIZES = "135vw";

export function IntroStage() {
  const prefersReduced = useReducedMotion();
  const [skipped, setSkipped] = useState(false);
  const [chromeCued, setChromeCued] = useState(false);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);

  /** Jump straight to the finished composition. */
  const instant = skipped || prefersReduced === true;
  /** Everything has landed, so idle motion can take over. */
  const settled = instant || sequenceDone;
  /** Retired as the CTA arrives so the two never share the same slot. */
  const skippable = !instant && !chromeCued;

  const skip = useCallback(() => setSkipped(true), []);

  useEffect(() => {
    if (instant) return;
    const timers = [
      window.setTimeout(() => setChromeCued(true), CUE.chrome * 1000),
      window.setTimeout(() => setSequenceDone(true), SEQUENCE_END * 1000),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [instant]);

  // Let an impatient agent cut straight to the composition. Enter/Space are
  // left alone once the CTA is focusable so they don't hijack activating it.
  useEffect(() => {
    if (!skippable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skippable, skip]);

  const animated = !instant;
  /** Remounting on skip lets `initial={false}` snap every plate to its end state. */
  const runKey = instant ? "settled" : "playing";

  return (
    <main
      className="relative h-dvh w-screen overflow-hidden bg-void"
      onPointerDown={skippable ? skip : undefined}
    >
      {/* 1 — Backdrop. Fixed: it never scales, pans, or moves. */}
      <motion.div
        key={`backdrop-${runKey}`}
        className="absolute inset-0"
        initial={animated ? { opacity: 0, scale: 1.04 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          animated
            ? { duration: DURATION.backdrop, delay: CUE.backdrop, ease: "easeOut" }
            : INSTANT
        }
      >
        <Image
          src={backdrop}
          alt=""
          fill
          priority
          quality={90}
          sizes="100vw"
          placeholder="blur"
          className="object-cover"
        />
      </motion.div>

      {/* The 16:9 art stage, contain-fit and centred inside the viewport. */}
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="relative aspect-video w-full"
          style={{ maxWidth: "var(--stage-width)" }}
        >
          {/* Glow seeded behind the keyhole; starts pulsing once the crest lands. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-[41%] size-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal blur-[60px] ${
              settled ? "core-pulse" : "opacity-0"
            }`}
          />

          {/* 2 — Crest closes distance and comes to rest. */}
          <motion.div
            key={`crest-${runKey}`}
            className="absolute inset-0"
            initial={
              animated
                ? {
                    opacity: 0,
                    scale: CREST_START_SCALE,
                    filter: "blur(14px) brightness(1.7)",
                  }
                : false
            }
            animate={{ opacity: 1, scale: 1, filter: "blur(0px) brightness(1)" }}
            transition={
              animated
                ? {
                    duration: DURATION.crest,
                    delay: CUE.crest,
                    ease: APPROACH,
                    filter: {
                      duration: DURATION.crest * 0.6,
                      delay: CUE.crest,
                      ease: "easeOut",
                    },
                  }
                : INSTANT
            }
            style={{ willChange: "transform, filter, opacity" }}
          >
            <div className={settled ? "crest-breathe absolute inset-0" : "absolute inset-0"}>
              <Image
                src={crest}
                alt="S.H.I.E.L.D. winged crest with a glowing keyhole"
                fill
                priority
                quality={95}
                sizes={PLATE_SIZES}
                className={PLATE}
              />
            </div>
          </motion.div>

          {/* Impact flash on the title hit. */}
          {animated && (
            <motion.div
              aria-hidden
              key={`flash-${runKey}`}
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_60%,rgba(255,255,255,0.85),transparent_70%)] mix-blend-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.55, 0] }}
              transition={{ delay: CUE.title, duration: 0.5, times: [0, 0.18, 1] }}
            />
          )}

          {/* 3 — Title lands hard, with a one-shot RGB split. */}
          {animated && (
            <>
              <motion.div
                aria-hidden
                key={`split-a-${runKey}`}
                className="absolute inset-0 mix-blend-screen [filter:hue-rotate(165deg)]"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: [0, 0.7, 0], x: [-18, -7, 0] }}
                transition={{ delay: CUE.title, duration: 0.4, ease: IMPACT }}
              >
                <Image src={title} alt="" fill sizes={PLATE_SIZES} className={PLATE} />
              </motion.div>
              <motion.div
                aria-hidden
                key={`split-b-${runKey}`}
                className="absolute inset-0 mix-blend-screen"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: [0, 0.55, 0], x: [18, 7, 0] }}
                transition={{ delay: CUE.title, duration: 0.4, ease: IMPACT }}
              >
                <Image src={title} alt="" fill sizes={PLATE_SIZES} className={PLATE} />
              </motion.div>
            </>
          )}

          <motion.div
            key={`title-${runKey}`}
            className="absolute inset-0"
            initial={animated ? { opacity: 0, scale: 1.14 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              animated
                ? { duration: DURATION.title, delay: CUE.title, ease: IMPACT }
                : INSTANT
            }
          >
            <Image
              src={title}
              alt="Capture The Flag"
              fill
              priority
              quality={95}
              sizes={PLATE_SIZES}
              className={PLATE}
            />
          </motion.div>

          {/* 4 — Clearance line resolves last. */}
          <motion.div
            key={`subtitle-${runKey}`}
            className="absolute inset-0"
            initial={animated ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={
              animated
                ? { duration: DURATION.subtitle, delay: CUE.subtitle, ease: "easeOut" }
                : INSTANT
            }
          >
            <Image
              src={subtitle}
              alt="Clearance Level 7 Agents Only"
              fill
              quality={95}
              sizes={PLATE_SIZES}
              className={PLATE}
            />
          </motion.div>
        </div>
      </div>

      {/* 5 — Access CTA. Anchored to the viewport, not the stage: on 16:9 that
          puts it just under the clearance line, and on taller screens it drops
          into the clear space below the letterboxed art. */}
      <motion.div
        key={`cta-${runKey}`}
        className="absolute inset-x-0 bottom-[6%] z-20 flex justify-center"
        initial={animated ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={
          animated
            ? { duration: DURATION.chrome, delay: CUE.chrome, ease: "easeOut" }
            : INSTANT
        }
      >
        <button
          type="button"
          onClick={() => setAccessOpen(true)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-haspopup="dialog"
          aria-expanded={accessOpen}
          className="group inline-flex items-center gap-3 border border-signal/40 bg-void/55 px-6 py-2.5 font-mono text-[11px] tracking-[0.3em] text-signal backdrop-blur-sm transition-colors hover:border-signal hover:bg-signal/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal sm:text-xs"
        >
          BREACH THE VAULT
          <span className="transition-transform group-hover:translate-x-1">&rsaquo;</span>
        </button>
      </motion.div>

      {/* Screen treatment, above the art and below the chrome. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-10 vignette" />
      <div
        aria-hidden
        className="scanlines pointer-events-none absolute inset-0 z-10 opacity-35 mix-blend-overlay"
      />
      <div
        aria-hidden
        className="grain pointer-events-none absolute inset-0 z-10 opacity-[0.05] mix-blend-overlay"
      />

      <HudFrame />

      {skippable && (
        <button
          type="button"
          onClick={skip}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-signal/45 transition-colors hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal sm:bottom-6"
        >
          SKIP TRANSMISSION
        </button>
      )}

      <AccessPanel open={accessOpen} onClose={() => setAccessOpen(false)} />
    </main>
  );
}
