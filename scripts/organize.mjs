// Rearrange a save folder's mules (see src/lib/organize.js) and write the changed saves to a new folder.
// Usage: node scripts/organize.mjs <save dir> <out dir>   (out dir must not exist; save dir is only read)
// Checks the written files: every moved item is there exactly once and no two items overlap.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const [dir, outDir] = process.argv.slice(2);
if (!dir || !outDir) throw new Error("usage: node scripts/organize.mjs <save dir> <out dir>");
if (existsSync(outDir)) throw new Error(`${outDir} already exists`);

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const wasm = await vite.ssrLoadModule("/wasm/pkg/d2_parser.js");
  wasm.initSync({ module: readFileSync(new URL("../wasm/pkg/d2_parser_bg.wasm", import.meta.url)) });
  const { organize } = await vite.ssrLoadModule("/src/lib/organize.js");
  const { default: items } = await vite.ssrLoadModule("/src/data/items.json");
  const { codeOfNumber } = await vite.ssrLoadModule("/src/lib/gameData.js");

  const parse = (ext, bytes) => JSON.parse(ext === "d2s" ? wasm.parseD2s(bytes) : wasm.parseD2i(bytes));
  const saves = readdirSync(dir)
    .filter((f) => /\.d2[si]$/.test(f))
    .map((f) => ({ name: f.slice(0, -4), ext: f.slice(-3), json: parse(f.slice(-3), readFileSync(join(dir, f))) }));
  const { saves: changed, report } = organize(saves);

  mkdirSync(outDir);
  for (const s of changed) {
    const json = JSON.stringify(s.json);
    writeFileSync(join(outDir, `${s.name}.${s.ext}`), s.ext === "d2s" ? wasm.writeD2s(json) : wasm.writeD2i(json));
    for (const ext of ["ctl", "key", "ma0", "map"]) {
      const from = join(dir, `${s.template}.${ext}`);
      if (s.template && existsSync(from)) copyFileSync(from, join(outDir, `${s.name}.${ext}`));
    }
  }

  // Item contents without position, before (mule and shared page items, minus starting kit) and after
  const fingerprint = (item) => JSON.stringify({ ...item, position: undefined });
  const stored = (save, ext) =>
    ext === "d2s" ? save.items : save.filter((t) => t.tab_type === "Normal").flatMap((t) => t.items);
  const before = changed
    .filter((s) => !s.template)
    .flatMap((s) => stored(parse(s.ext, readFileSync(join(dir, `${s.name}.${s.ext}`))), s.ext))
    .filter((i) => i.position.mode === "Stored" && !["tsc", "isc"].includes(codeOfNumber(i.code)));
  const after = [];
  for (const s of changed) {
    const save = parse(s.ext, readFileSync(join(outDir, `${s.name}.${s.ext}`)));
    const list = stored(save, s.ext);
    after.push(...list);
    if (s.ext !== "d2s") continue;
    const used = new Set();
    for (const i of list) {
      const { w, h } = items[codeOfNumber(i.code)];
      const { store_page: page, inv_x: x, inv_y: y } = i.position;
      const [W, H] = page === "Stash" ? [10, 10] : [10, 4];
      if (x + w > W || y + h > H) throw new Error(`${s.name}: item out of the grid at ${page} ${x},${y}`);
      for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) {
        const cell = `${page}:${x + a}:${y + b}`;
        if (used.has(cell)) throw new Error(`${s.name}: items overlap at ${cell}`);
        used.add(cell);
      }
    }
  }
  const same = JSON.stringify(before.map(fingerprint).sort()) === JSON.stringify(after.map(fingerprint).sort());
  if (!same) throw new Error(`item check failed: ${before.length} items before, ${after.length} after`);

  console.log(`moved ${report.moved} items, dropped ${report.dropped} starting items, check passed`);
  console.log("museum (owned / slots):", Object.entries(report.museum).map(([p, m]) => `${p} ${m.owned}/${m.total}`).join("  "));
  console.log(report.mules.map((m) => `${m.name}:${m.items}`).join(" "));
  console.log(`${changed.length} files written to ${outDir}`);
} finally {
  await vite.close();
}
