// Convert D2R inventory icons (.sprite, extracted from CASC) to WebP in public/items/<asset>.webp,
// where <asset> is how data/hd/items/*.json name them ("axe/hand_axe"). Low-end sprites are skipped.
// Usage: node scripts/gen-images.mjs [gamedata dir]   (default: ~/Projects/Diablo2/d2r-gamedata)
// The dir must contain data/hd/global/ui/items/<group>/<asset>.sprite.
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = process.argv[2] ?? join(homedir(), "Projects/Diablo2/d2r-gamedata");
const spriteDir = join(root, "data/hd/global/ui/items");
const outDir = new URL("../public/items/", import.meta.url).pathname;
const CELL = 98; // sprite pixels per inventory cell
const OUT_CELL = 80; // output pixels per cell: sharp on a 44px cell at 2x

// SpA1: u16 version, u16 frame width, u32 total width, u32 height, ... RGBA pixels from byte 40
function decode(buf) {
  if (buf.toString("ascii", 0, 4) !== "SpA1") throw new Error("not a SpA1 sprite");
  const width = buf.readUInt32LE(8);
  const height = buf.readUInt32LE(12);
  return { width, height, pixels: buf.subarray(40, 40 + width * height * 4) };
}

let count = 0;
for (const group of readdirSync(spriteDir)) {
  for (const sub of readdirSync(join(spriteDir, group))) {
    for (const file of readdirSync(join(spriteDir, group, sub))) {
      if (!file.endsWith(".sprite") || file.endsWith(".lowend.sprite")) continue;
      const { width, height, pixels } = decode(readFileSync(join(spriteDir, group, sub, file)));
      const out = join(outDir, sub, file.replace(/\.sprite$/, ".webp"));
      mkdirSync(dirname(out), { recursive: true });
      await sharp(pixels, { raw: { width, height, channels: 4 } })
        .resize(Math.round((width / CELL) * OUT_CELL), Math.round((height / CELL) * OUT_CELL))
        .webp({ quality: 80, alphaQuality: 90 })
        .toFile(out);
      count++;
    }
  }
}
console.log(`${count} icons written to ${outDir}`);
