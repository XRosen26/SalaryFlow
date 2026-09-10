import fs from "node:fs";
import { deflateSync } from "node:zlib";
const size = 256,
  raw = Buffer.alloc((size * 4 + 1) * size);
const rounded = (x, y, l, t, r, b, rad) => {
  const cx = Math.max(l + rad, Math.min(r - rad, x)),
    cy = Math.max(t + rad, Math.min(b - rad, y));
  return (
    x >= l &&
    x <= r &&
    y >= t &&
    y <= b &&
    (x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2
  );
};
for (let y = 0; y < size; y++) {
  raw[y * (size * 4 + 1)] = 0;
  for (let x = 0; x < size; x++) {
    let sums = [0, 0, 0, 0];
    for (let sy = 0; sy < 2; sy++)
      for (let sx = 0; sx < 2; sx++) {
        const px = x + (sx + 0.5) / 2,
          py = y + (sy + 0.5) / 2;
        let color = rounded(px, py, 4, 4, 252, 252, 63)
          ? [39, 103, 79, 255]
          : [0, 0, 0, 0];
        const outline =
          rounded(px, py, 61, 75, 194, 192, 15) &&
          !rounded(px, py, 70, 84, 185, 183, 7);
        const flap =
          rounded(px, py, 151, 113, 207, 159, 9) &&
          !rounded(px, py, 160, 122, 198, 150, 3);
        const back = px >= 74 && px <= 177 && py >= 62 && py <= 69;
        const button = (px - 175) ** 2 + (py - 136) ** 2 < 20;
        if (outline || flap || back || button) color = [244, 250, 246, 255];
        for (let i = 0; i < 4; i++) sums[i] += color[i] / 4;
      }
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    for (let i = 0; i < 4; i++) raw[offset + i] = Math.round(sums[i]);
  }
}
const crc = (buf) => {
  let c = 0xffffffff;
  for (const n of buf) {
    c ^= n;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (name, data) => {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length);
  b.write(name, 4);
  data.copy(b, 8);
  b.writeUInt32BE(crc(b.subarray(4, -4)), b.length - 4);
  return b;
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.mkdirSync("build", { recursive: true });
fs.writeFileSync("build/icon.png", png);
const head = Buffer.alloc(22);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(1, 4);
head.writeUInt16LE(1, 10);
head.writeUInt16LE(32, 12);
head.writeUInt32LE(png.length, 14);
head.writeUInt32LE(22, 18);
fs.writeFileSync("build/icon.ico", Buffer.concat([head, png]));
console.log("Created SalaryFlow application icon");
