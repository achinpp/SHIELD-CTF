# S.H.I.E.L.D. // Capture The Flag

Landing terminal for the S.H.I.E.L.D.-themed CTF. The intro reproduces
`design/full-image.png` as a cinematic: the backdrop resolves out of black, the
winged crest closes distance and comes to rest, the title lands with an impact
flash, and the clearance line resolves last.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + TypeScript 5 |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) |
| Motion | Motion 13 (`motion/react`) |
| Image pipeline | `next/image` static imports + `sharp` for asset prep |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run assets:prepare` | Regenerate the alpha plates and app icon |

## How the artwork is composed

All four source plates are 16:9 full-frame layers that stack to reproduce the
design exactly, so the page is a stack of absolutely-positioned layers inside
one 16:9 stage rather than a hand-built layout.

**The source plates have no alpha channel.** `cool-lock.png`, `capture.png` and
`some-text.png` ship as 24-bit RGB flattened onto solid white, so stacking them
directly just paints white over the backdrop. `scripts/prepare-plates.mjs`
recovers the real alpha: each layer is known over two different backdrops — flat
white (the supplied plate) and the design composite over `background.png` — and
subtracting the two eliminates the unknown colour, leaving alpha exactly.

```
plate = C·a + 255·(1 - a)          →   (1 - a) = Σ(plate - ref) / Σ(255 - B)
ref   = C·a +   B·(1 - a)              C·a     = ref - B·(1 - a)
```

Plates are solved back-to-front so each is measured against the backdrop it was
actually composited over. The reconstruction lands within **2.75/255 mean
absolute error** of the original design, reported every time the script runs.

Regenerate with `npm run assets:prepare`. Output goes to `src/assets/plates/`
and is committed, so a plain `npm install && npm run build` needs no image work.

## Sequence

Every cue and easing curve lives in `src/lib/sequence.ts` — adjust timings
there rather than in the component.

| t (s) | Layer | Motion |
|---|---|---|
| 0.00 | backdrop | fades up from black; **fixed** thereafter — never pans or scales |
| 0.45 | crest | scale 0.42 → 1 with blur and brightness falling off, over 3.0s |
| 3.25 | title | scale 1.14 → 1 with an impact flash and a one-shot RGB split |
| 4.00 | subtitle | fade and rise |
| 4.75 | chrome | access CTA |

Once settled, the crest picks up a slow breathing drift and the keyhole glow
pulses.

- **Skip** — click, tap, or press `Esc` / `Enter` / `Space` during playback.
- **Reduced motion** — `prefers-reduced-motion: reduce` renders the finished
  composition immediately, with all idle animation disabled.

## Responsive behaviour

The art lives in a 16:9 stage sized by `--stage-width` in `globals.css`. At 16:9
and wider it is contain-fit and pillarboxed over the backdrop; on taller
viewports it grows to 1.35× the viewport width and bleeds off the sides. The
title occupies 18%–83% of the frame, so that crop only ever reaches the outer
wing tips. The CTA is anchored to the viewport rather than the stage so it
lands under the clearance line on 16:9 and in clear space on tall screens.

## Layout

```
design/full-image.png        reference composite — ground truth for asset prep
scripts/prepare-plates.mjs   alpha recovery + app icon generation
src/assets/                  original artwork (flat, no alpha)
src/assets/plates/           generated alpha plates — imported by the app
src/lib/sequence.ts          cue times, durations, easing curves
src/components/intro-stage.tsx   the cinematic
src/components/hud-frame.tsx     terminal chrome
src/app/briefing/            placeholder target for the CTA — replace with the
                             challenge board
```
