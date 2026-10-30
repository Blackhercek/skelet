// Draws the app icons (PNG) without any image library: signed-distance shapes, anti-aliased per pixel.
// Output: public/apple-touch-icon.png (180), icon-192.png, icon-512.png, icon-maskable-512.png
import fs from 'node:fs';
import zlib from 'node:zlib';

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

// Signed distances in the unit square.
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
const capsule = (x, y, ax, ay, bx, by, r) => {
  const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
  const h = clamp((px * dx + py * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - dx * h, py - dy * h) - r;
};

function draw(size, scale) {
  const BG_TOP = hex('#18223d'), BG_BOTTOM = hex('#080b11'), ACCENT = hex('#5b8cff'), SKIN = hex('#eef2fb');
  const pixels = Buffer.alloc(size * size * 4);
  // Figure coordinates are scaled around the centre so the maskable icon keeps it inside the safe zone.
  const f = v => 0.5 + (v - 0.5) * scale, r = v => v * scale;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size, y = (py + 0.5) / size;
      let color = mix(BG_TOP, BG_BOTTOM, clamp(y * 1.15));
      color = mix(color, ACCENT, 0.16 * clamp(1 - Math.hypot(x - 0.5, y - 0.42) / 0.55)); // soft glow behind the figure
      const aa = d => clamp(0.5 - d * size);
      // stage ring
      const ring = Math.abs(Math.hypot((x - 0.5) / 0.26, (y - f(0.84)) / 0.05) - 1) * 0.04 * scale;
      color = mix(color, ACCENT, 0.7 * aa(ring - 0.004 * scale));
      // body
      const body = Math.min(
        capsule(x, y, f(0.5), f(0.37), f(0.5), f(0.6), r(0.05)),
        capsule(x, y, f(0.5), f(0.4), f(0.31), f(0.57), r(0.034)),
        capsule(x, y, f(0.5), f(0.4), f(0.69), f(0.57), r(0.034)),
        capsule(x, y, f(0.47), f(0.6), f(0.4), f(0.81), r(0.04)),
        capsule(x, y, f(0.53), f(0.6), f(0.6), f(0.81), r(0.04)),
      );
      color = mix(color, ACCENT, aa(body));
      color = mix(color, SKIN, aa(circle(x, y, f(0.5), f(0.255), r(0.092))));
      const o = (py * size + px) * 4;
      pixels[o] = Math.round(color[0] * 255); pixels[o + 1] = Math.round(color[1] * 255); pixels[o + 2] = Math.round(color[2] * 255); pixels[o + 3] = 255;
    }
  }
  return pixels;
}

function encodePng(size, pixels) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(zlib.crc32(body) >>> 0, body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../public/', import.meta.url);
for (const [name, size, scale] of [['apple-touch-icon.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, 0.72]]) {
  const png = encodePng(size, draw(size, scale));
  fs.writeFileSync(new URL(name, out), png);
  console.log(`${name}: ${size}×${size}, ${(png.length / 1024).toFixed(1)} KB`);
}
