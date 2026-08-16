import type { Transition } from "motion/react";

/**
 * Single source of truth for the landing cinematic.
 *
 * The four artwork layers are all 16:9 full-frame plates that stack to
 * reproduce `design/full-image.png` exactly, so the sequence is purely a
 * matter of *when* and *how* each plate arrives:
 *
 *   1. backdrop  - fixed, never transforms. Just resolves out of black.
 *   2. crest     - the winged keyhole travels toward the camera and settles.
 *   3. title     - "CAPTURE THE FLAG" hits with an impact flash + RGB split.
 *   4. subtitle  - "CLEARANCE LEVEL 7" resolves last.
 *   5. chrome    - HUD frame and the access CTA.
 *
 * All values are seconds.
 */
export const CUE = {
  backdrop: 0.0,
  crest: 0.45,
  title: 3.25,
  subtitle: 4.0,
  chrome: 4.75,
} as const;

export const DURATION = {
  backdrop: 1.4,
  /** Deliberately long — the crest should *drift* in, not snap. */
  crest: 3.0,
  title: 0.55,
  subtitle: 0.9,
  chrome: 0.8,
} as const;

/** Scale the crest starts at, i.e. how far "back" it begins. */
export const CREST_START_SCALE = 0.42;

/** When the whole cinematic has settled, for anything that waits it out. */
export const SEQUENCE_END = CUE.chrome + DURATION.chrome;

/**
 * A steady push-in with a soft landing. Deliberately less front-loaded than a
 * standard expo-out, which lunges in the first few hundred milliseconds and
 * then crawls — this keeps the crest moving at a readable pace throughout and
 * only bleeds off speed near the end.
 */
export const APPROACH: Transition["ease"] = [0.2, 0.55, 0.2, 1];

/** Sharp in, no overshoot. Used for the title impact. */
export const IMPACT: Transition["ease"] = [0.7, 0, 0.2, 1];

/** Applied to every layer when the intro is skipped or motion is reduced. */
export const INSTANT: Transition = { duration: 0, delay: 0 };
