/**
 * One-time asset preparation.
 *
 * The source artwork ships as 24-bit RGB with the layer flattened onto solid
 * white — there is no alpha channel, so stacking the plates directly just
 * paints white over the backdrop. This script recovers the real alpha.
 *
 * For each pixel we know the layer composited over two different backdrops:
 *
 *   plate = C·a + 255·(1 - a)      (the supplied plate, flattened on white)
 *   ref   = C·a +   B·(1 - a)      (design/full-image.png, over known backdrop B)
 *
 * Subtracting eliminates the unknown colour C and leaves alpha exactly:
 *
 *   (1 - a) = Σ(plate - ref) / Σ(255 - B)          summed over R,G,B
 *   C·a     = ref - B·(1 - a)
 *
 * The plates are solved back-to-front so each one is measured against the
 * backdrop it was actually composited over, not the raw background.
 *
 * Run with `npm run assets:prepare`. Output lands in src/assets/plates/.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "src/assets";
const OUT = "src/assets/plates";
const REF = "design/full-image.png";

/** The reference composite's resolution — all solving happens here. */
const W = 1920;
const H = 1080;

/**
 * Below this, alpha is treated as background noise; above it, as fully
 * opaque. Keeps the busy starburst backdrop from picking up a flat haze.
 */
const FLOOR = 0.06;
const CEIL = 0.985;

/** Layers in composite order, with the resolution each is written out at. */
const LAYERS = [
  { name: "crest", file: "cool-lock.png", outWidth: 3840 },
  { name: "title", file: "capture.png", outWidth: 1920 },
  { name: "subtitle", file: "some-text.png", outWidth: 1920 },
];

const readRGB = (file, w = W, h = H) =>
  sharp(file).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer();

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

/** Max-alpha recovery from the white composite alone. Used where the
 *  reference is occluded by a layer stacked above this one. */
function whiteKeyAlpha(plate, i) {
  const min = Math.min(plate[i], plate[i + 1], plate[i + 2]);
  // Saturating: anything meaningfully off-white is opaque coverage.
  return clamp01((1 - min / 255) / 0.7);
}

/**
 * @returns {{ alpha: Float32Array, colour: Float32Array }} straight (un-premultiplied)
 *   colour and per-pixel alpha at W×H.
 */
function solvePlate(plate, ref, backdrop, occluded) {
  const n = W * H;
  const alpha = new Float32Array(n);
  const colour = new Float32Array(n * 3);

  for (let p = 0; p < n; p++) {
    const i = p * 3;

    let a;
    if (occluded[p]) {
      a = whiteKeyAlpha(plate, i);
    } else {
      let num = 0;
      let den = 0;
      for (let c = 0; c < 3; c++) {
        num += plate[i + c] - ref[i + c];
        den += 255 - backdrop[i + c];
      }
      a = clamp01(1 - num / den);
    }

    if (a < FLOOR) a = 0;
    else if (a > CEIL) a = 1;

    alpha[p] = a;
    if (a === 0) continue;

    // Recover straight colour from the white composite, which is available at
    // full resolution and free of any occlusion: C = (plate - 255(1-a)) / a.
    const inv = 255 * (1 - a);
    for (let c = 0; c < 3; c++) {
      colour[i + c] = clamp255((plate[i + c] - inv) / a);
    }
  }

  return { alpha, colour };
}

/** Paint a solved layer onto an RGB backdrop, in place. */
function compositeOnto(backdrop, alpha, colour) {
  for (let p = 0; p < W * H; p++) {
    const a = alpha[p];
    if (a === 0) continue;
    const i = p * 3;
    for (let c = 0; c < 3; c++) {
      backdrop[i + c] = clamp255(colour[i + c] * a + backdrop[i + c] * (1 - a));
    }
  }
}

/** Bilinear resample of the alpha channel up to the output resolution. */
function resampleAlpha(alpha, outW, outH) {
  if (outW === W && outH === H) return alpha;
  const out = new Float32Array(outW * outH);
  const sx = W / outW;
  const sy = H / outH;
  for (let y = 0; y < outH; y++) {
    const fy = Math.min(H - 1, (y + 0.5) * sy - 0.5);
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(H - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < outW; x++) {
      const fx = Math.min(W - 1, (x + 0.5) * sx - 0.5);
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(W - 1, x0 + 1);
      const wx = fx - x0;
      const top = alpha[y0 * W + x0] * (1 - wx) + alpha[y0 * W + x1] * wx;
      const bot = alpha[y1 * W + x0] * (1 - wx) + alpha[y1 * W + x1] * wx;
      out[y * outW + x] = top * (1 - wy) + bot * wy;
    }
  }
  return out;
}

/**
 * Write RGBA at the plate's native resolution, taking colour from the
 * full-resolution white composite so 4K detail survives.
 */
async function writePlate(name, file, alpha, outWidth) {
  const outHeight = Math.round((outWidth / 16) * 9);
  const native = await readRGB(path.join(SRC, file), outWidth, outHeight);
  const a = resampleAlpha(alpha, outWidth, outHeight);

  const rgba = Buffer.alloc(outWidth * outHeight * 4);
  for (let p = 0; p < outWidth * outHeight; p++) {
    const av = a[p];
    const o = p * 4;
    if (av <= 0) continue;
    const i = p * 3;
    const inv = 255 * (1 - av);
    for (let c = 0; c < 3; c++) {
      rgba[o + c] = clamp255((native[i + c] - inv) / av);
    }
    rgba[o + 3] = Math.round(av * 255);
  }

  const dest = path.join(OUT, `${name}.png`);
  await sharp(rgba, { raw: { width: outWidth, height: outHeight, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(dest);
  console.log(`  ${dest}  ${outWidth}x${outHeight}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const ref = await readRGB(REF);
  const background = await readRGB(path.join(SRC, "background.png"));
  const plates = await Promise.all(
    LAYERS.map((l) => readRGB(path.join(SRC, l.file))),
  );

  // A layer's reference pixels are unusable wherever a layer above it has
  // coverage, so flag those and fall back to the white key there.
  const occlusion = LAYERS.map((_, idx) => {
    const mask = new Uint8Array(W * H);
    for (let above = idx + 1; above < LAYERS.length; above++) {
      const p = plates[above];
      for (let q = 0; q < W * H; q++) {
        const i = q * 3;
        if (Math.min(p[i], p[i + 1], p[i + 2]) < 250) mask[q] = 1;
      }
    }
    return mask;
  });

  const backdrop = Buffer.from(background);
  const solved = [];

  console.log("Solving plates:");
  for (let idx = 0; idx < LAYERS.length; idx++) {
    const { name } = LAYERS[idx];
    const s = solvePlate(plates[idx], ref, backdrop, occlusion[idx]);
    solved.push(s);
    compositeOnto(backdrop, s.alpha, s.colour);

    let opaque = 0;
    let clear = 0;
    for (const a of s.alpha) {
      if (a === 0) clear++;
      else if (a === 1) opaque++;
    }
    const n = s.alpha.length;
    console.log(
      `  ${name.padEnd(9)} clear ${((clear / n) * 100).toFixed(1)}%  ` +
        `opaque ${((opaque / n) * 100).toFixed(1)}%  ` +
        `partial ${(((n - clear - opaque) / n) * 100).toFixed(1)}%`,
    );
  }

  // The final `backdrop` is our reconstruction; compare it to the design.
  let sum = 0;
  let worst = 0;
  for (let i = 0; i < W * H * 3; i++) {
    const d = Math.abs(backdrop[i] - ref[i]);
    sum += d;
    if (d > worst) worst = d;
  }
  console.log(
    `\nReconstruction vs design/full-image.png: mean |Δ| ${(sum / (W * H * 3)).toFixed(2)}/255, max ${worst}`,
  );

  console.log("\nWriting plates:");
  for (let idx = 0; idx < LAYERS.length; idx++) {
    const { name, file, outWidth } = LAYERS[idx];
    await writePlate(name, file, solved[idx].alpha, outWidth);
  }

  await writeIcon();
}

/** App icon: the shield cropped out of the crest, over the site's void colour. */
async function writeIcon() {
  const shield = await sharp(path.join(OUT, "crest.png"))
    .extract({ left: 1355, top: 438, width: 1120, height: 1120 })
    .resize(400, 400)
    .toBuffer();

  const dest = "src/app/icon.png";
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 5, g: 10, b: 18, alpha: 1 },
    },
  })
    .composite([{ input: shield, gravity: "centre" }])
    .png()
    .toFile(dest);
  console.log(`  ${dest}  512x512`);
}

await main();
