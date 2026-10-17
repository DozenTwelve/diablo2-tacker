// Rearrange a save folder's mules (see src/lib/organize.js) and write the changed saves to a new folder.
// Usage: node scripts/organize.mjs <save dir> <out dir> [--mode SoftCore:Modern] [--mules a,b,c] [--yes]
//   --mode   game mode to organize: SoftCore|HardCore : Modern (Reign of the Warlock)|Legacy
//   --mules  characters to empty into the new mules (default: every level 1 character of the mode)
//   --yes    write; without it, only list which characters would be emptied and what would be made
// The save dir is only read; the out dir must not exist. Everything is written to <out dir>.partial and
// checked there (every item is kept exactly once, only starting kit is dropped, nothing overlaps); only
// then it becomes <out dir>. plan.txt there lists every moved item (it is not a save).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const mode = option("--mode") ?? "SoftCore:Modern";
const muleNames = option("--mules")?.split(",");
const yes = args.includes("--yes");
const [dir, outDir] = args.filter((a) => a !== "--yes");
if (!dir || !outDir) throw new Error("usage: node scripts/organize.mjs <save dir> <out dir> [--mode ...] [--mules a,b] [--yes]");
const partial = `${outDir}.partial`;
if (existsSync(outDir) || existsSync(partial)) throw new Error(`${outDir} or ${partial} already exists`);

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const wasm = await vite.ssrLoadModule("/wasm/pkg/d2_parser.js");
  wasm.initSync({ module: readFileSync(new URL("../wasm/pkg/d2_parser_bg.wasm", import.meta.url)) });
  const { organize } = await vite.ssrLoadModule("/src/lib/organize.js");
  const { default: items } = await vite.ssrLoadModule("/src/data/items.json");
  const { codeOfNumber, labelOf } = await vite.ssrLoadModule("/src/lib/gameData.js");
  const { ownerLabel } = await vite.ssrLoadModule("/src/lib/inventory.js");

  const parse = (ext, bytes) => JSON.parse(ext === "d2s" ? wasm.parseD2s(bytes) : wasm.parseD2i(bytes));
  const write = (ext, json) => (ext === "d2s" ? wasm.writeD2s : wasm.writeD2i)(JSON.stringify(json));
  // A save must come back byte for byte from its JSON: JavaScript numbers can't hold every 64-bit value
  const saves = readdirSync(dir)
    .filter((f) => /\.d2[si]$/.test(f))
    .map((f) => {
      const bytes = readFileSync(join(dir, f));
      const save = { name: f.slice(0, -4), ext: f.slice(-3) };
      save.json = parse(save.ext, bytes);
      if (Buffer.compare(Buffer.from(write(save.ext, save.json)), bytes)) throw new Error(`${f} does not round-trip, not touching it`);
      return save;
    });
  const { saves: changed, report } = organize(saves, { mode, mules: muleNames });

  console.log(`mode ${mode}: emptying ${report.mules.length} characters into ${report.newMules.length} mules cloned from ${report.template}`);
  for (const name of report.mules) {
    const c = saves.find((s) => s.name === name).json.character;
    console.log(`  ${name} (${c.class} level ${c.level})`);
  }
  console.log(`${report.moved} items move, ${report.dropped.length} starting items are dropped`);
  console.log("museum (owned / slots):", Object.entries(report.museum).map(([p, m]) => `${p} ${m.owned}/${m.total}`).join("  "));
  console.log(report.newMules.map((m) => `${m.name}:${m.items}`).join(" "));
  if (!yes) {
    console.log("nothing written; check the characters above and run again with --yes");
    process.exit(0);
  }

  mkdirSync(partial);
  try {
    for (const s of changed) {
      writeFileSync(join(partial, `${s.name}.${s.ext}`), write(s.ext, s.json));
      for (const ext of ["ctl", "key", "ma0", "map"]) {
        const from = join(dir, `${s.template}.${ext}`);
        if (s.template && existsSync(from) && !existsSync(join(dir, `${s.name}.${ext}`))) copyFileSync(from, join(partial, `${s.name}.${ext}`));
      }
    }
    const plan = report.moves
      .map((m) => {
        const [owner, place] = m.from.split(" ");
        const from = `${ownerLabel(owner, "zh_tw")} ${/^\d+$/.test(place) ? `第${place}頁` : place}`;
        return [from, labelOf(m.key, "zh_tw"), `→ ${m.to} ${m.page} (${m.x},${m.y})`].join("\t");
      })
      .sort((a, b) => a.localeCompare(b));
    writeFileSync(join(partial, "plan.txt"), plan.join("\n") + "\n");

    // Items without their position: before (the emptied characters and the mode's shared pages, as read)
    // minus the dropped starting kit must equal after (every written save)
    const fingerprint = (item) => JSON.stringify({ ...item, position: undefined });
    const held = (save, ext) =>
      ext === "d2s" ? [...save.items, ...(save.merc_items?.items ?? [])] : save.filter((t) => t.tab_type === "Normal").flatMap((t) => t.items);
    const sources = new Set([...report.mules, ...changed.filter((s) => s.ext === "d2i").map((s) => s.name)]);
    const before = saves.filter((s) => sources.has(s.name)).flatMap((s) => held(s.json, s.ext));
    const after = changed.flatMap((s) => held(parse(s.ext, readFileSync(join(partial, `${s.name}.${s.ext}`))), s.ext));
    for (const item of report.dropped) {
      if (!items[codeOfNumber(item.code)]?.starter || item.quality !== "Normal") throw new Error("dropped something that is not starting kit");
    }
    const remaining = new Map();
    for (const f of before.map(fingerprint)) remaining.set(f, (remaining.get(f) ?? 0) + 1);
    for (const f of [...report.dropped, ...after].map(fingerprint)) {
      if (!remaining.get(f)) throw new Error("item check failed: an item was added or duplicated");
      remaining.set(f, remaining.get(f) - 1);
    }
    if ([...remaining.values()].some(Boolean)) throw new Error("item check failed: an item was lost");

    // Every written character holds only stored items, inside the stash (10x10) or inventory (10x4), not overlapping
    for (const s of changed.filter((s) => s.ext === "d2s")) {
      const used = new Set();
      for (const i of parse("d2s", readFileSync(join(partial, `${s.name}.d2s`))).items) {
        const { w, h } = items[codeOfNumber(i.code)];
        const { mode: where, store_page: page, inv_x: x, inv_y: y } = i.position;
        const [W, H] = { Stash: [10, 10], Inventory: [10, 4] }[page] ?? [0, 0];
        if (where !== "Stored" || x + w > W || y + h > H) throw new Error(`${s.name}: item outside the stash and inventory at ${page} ${x},${y}`);
        for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) {
          const cell = `${page}:${x + a}:${y + b}`;
          if (used.has(cell)) throw new Error(`${s.name}: items overlap at ${cell}`);
          used.add(cell);
        }
      }
    }
    renameSync(partial, outDir);
  } catch (e) {
    rmSync(partial, { recursive: true, force: true });
    throw e;
  }
  console.log(`check passed, ${changed.length} saves written to ${outDir}`);
} finally {
  await vite.close();
}
