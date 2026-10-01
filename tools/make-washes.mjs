/**
 * Draws the default overlay images: a top wash and a lower wash of grey ink, transparent elsewhere,
 * in the spirit of the D&D 5e system's texture-gray1/2 (ours are drawn here, not copied). Greyscale,
 * so they suit any theme color. Run with `node tools/make-washes.mjs`; writes styles/textures/.
 */
/* global document */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 1600;
const H = 560;
const OUT = new URL('../styles/textures/', import.meta.url);

/* Runs in the page: value-noise clouds, masked to a band that fades away from one edge. */
function draw({ W, H, flip, seed })
{
   let s = seed;
   const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
   const G = 64;
   const grid = Array.from({ length: (G + 1) * (G + 1) }, rand);
   const smooth = (t) => t * t * (3 - (2 * t));
   const noise = (x, y) =>
   {
      const xi = Math.floor(x) % G; const yi = Math.floor(y) % G;
      const xf = smooth(x - Math.floor(x)); const yf = smooth(y - Math.floor(y));
      const at = (i, j) => grid[(((yi + j) % G) * (G + 1)) + ((xi + i) % G)];
      const top = at(0, 0) + ((at(1, 0) - at(0, 0)) * xf);
      const bottom = at(0, 1) + ((at(1, 1) - at(0, 1)) * xf);
      return top + ((bottom - top) * yf);
   };
   const fbm = (x, y) =>
   {
      let sum = 0; let amp = 0.5; let f = 1;
      for (let o = 0; o < 6; o++) { sum += amp * noise(x * f, y * f); amp *= 0.5; f *= 2.03; }
      return sum;
   };
   const canvas = document.createElement('canvas');
   canvas.width = W; canvas.height = H;
   const ctx = canvas.getContext('2d');
   const img = ctx.createImageData(W, H);
   for (let y = 0; y < H; y++)
   {
      for (let x = 0; x < W; x++)
      {
         const u = x / W; const v = (flip ? (H - 1 - y) : y) / H;
         const cloud = fbm(u * 9, v * 4);
         const mottle = fbm((u * 26) + 3, (v * 11) + 5);
         // A watercolor stain: a ragged, wandering edge, a darker tide line along it, a blotchy fill.
         const edge = 0.4 + (0.36 * (fbm((u * 3) + 7, (v * 2) + 1.3) - 0.5)) + ((cloud - 0.5) * 0.22);
         const d = edge - v;
         const inside = Math.min(1, Math.max(0, (d + 0.004) / 0.008));
         const tide = Math.exp(-((d / 0.01) ** 2)) * 0.16;
         const depth = Math.max(0, 1 - (v / Math.max(0.1, edge)));
         const grain = fbm((u * 90) + 11, (v * 40) + 2);
         const m = Math.min(1, Math.max(0, 0.25 + ((mottle - 0.3) * 1.8) + ((grain - 0.5) * 0.5)));
         // Fades toward its own edge, so only a faint tide line marks it; a soft haze runs beyond.
         const stain = inside * (((depth ** 0.85) * m * 0.75) + tide);
         const haze = (Math.max(0, 1 - (v / 0.8)) ** 2) * 0.14 * (0.5 + m);
         const a = Math.min(1, stain + haze);
         const tone = 120 + (mottle * 60);
         const i = ((y * W) + x) * 4;
         img.data[i] = tone; img.data[i + 1] = tone * 0.96; img.data[i + 2] = tone * 0.93;
         img.data[i + 3] = a * 255;
      }
   }
   ctx.putImageData(img, 0, 0);
   return canvas.toDataURL('image/webp', 0.72);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
mkdirSync(OUT, { recursive: true });
for (const [name, flip, seed] of [['wash-top', false, 4211], ['wash-bottom', true, 9173]])
{
   const url = await page.evaluate(draw, { W, H, flip, seed });
   const bytes = Buffer.from(url.split(',')[1], 'base64');
   writeFileSync(new URL(`${name}.webp`, OUT), bytes);
   console.log(`${name}.webp ${Math.round(bytes.length / 1024)} KB`);
}
await browser.close();
