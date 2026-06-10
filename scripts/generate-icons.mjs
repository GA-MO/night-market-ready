// Procedurally renders the PWA icon set from an inline SVG (no hand-made binaries).
// A glowing paper lantern on the app's dark-navy + lantern-gold palette.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public");
mkdirSync(outDir, { recursive: true });

const NAVY = "#0b0d22";
const NAVY2 = "#161d3c";
const GOLD = "#ffd23f";
const RED = "#d62828";
const RED_HI = "#ff6b3a";

/** @param {number} pad fraction of the canvas kept clear around the art (maskable safe zone) */
function svg(size, pad = 0.0) {
  const s = size;
  const cx = s / 2;
  const inset = s * pad;
  const art = s - inset * 2; // drawable size
  const lw = art * 0.42; // lantern width
  const lh = art * 0.52; // lantern height
  const ly = cx; // lantern centre y
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="${NAVY2}"/>
      <stop offset="100%" stop-color="${NAVY}"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${RED_HI}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${RED_HI}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="body" cx="50%" cy="42%" r="60%">
      <stop offset="0%" stop-color="${RED_HI}"/>
      <stop offset="100%" stop-color="${RED}"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${ly}" r="${art * 0.46}" fill="url(#halo)"/>
  <rect x="${cx - lw * 0.18}" y="${ly - lh * 0.62}" width="${lw * 0.36}" height="${lh * 0.12}" rx="${s * 0.012}" fill="${GOLD}"/>
  <ellipse cx="${cx}" cy="${ly}" rx="${lw / 2}" ry="${lh / 2}" fill="url(#body)"/>
  <g stroke="#9c1414" stroke-opacity="0.55" fill="none" stroke-width="${s * 0.012}">
    <ellipse cx="${cx}" cy="${ly}" rx="${lw * 0.16}" ry="${lh / 2 - s * 0.01}"/>
    <ellipse cx="${cx}" cy="${ly}" rx="${lw * 0.34}" ry="${lh / 2 - s * 0.01}"/>
  </g>
  <ellipse cx="${cx}" cy="${ly}" rx="${lw * 0.12}" ry="${lh * 0.34}" fill="${GOLD}" fill-opacity="0.45"/>
  <rect x="${cx - lw * 0.18}" y="${ly + lh * 0.5}" width="${lw * 0.36}" height="${lh * 0.1}" rx="${s * 0.012}" fill="${GOLD}"/>
  <rect x="${cx - s * 0.012}" y="${ly + lh * 0.58}" width="${s * 0.024}" height="${lh * 0.14}" fill="${GOLD}"/>
</svg>`;
}

const targets = [
  { name: "pwa-192.png", size: 192, pad: 0 },
  { name: "pwa-512.png", size: 512, pad: 0 },
  { name: "maskable-512.png", size: 512, pad: 0.12 },
  { name: "apple-touch-icon.png", size: 180, pad: 0.06 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg(t.size, t.pad)))
    .png()
    .toFile(resolve(outDir, t.name));
  console.log(`✓ ${t.name} (${t.size}px)`);
}
console.log("Icons written to public/");
