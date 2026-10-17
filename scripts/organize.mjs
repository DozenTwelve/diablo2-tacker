// Rearrange a save folder's mules (see src/lib/organize.js) and write the changed saves to a new folder.
// Usage: node scripts/organize.mjs <save dir> <out dir> [--mode SoftCore:Modern] [--mules a,b,c] [--inbox 1,2] [--yes]
//   --mode   game mode to organize: SoftCore|HardCore : Modern (Reign of the Warlock)|Legacy
//   --mules  characters to empty into the new mules (default: every level 1 character of the mode)
//   --inbox  shared stash pages to empty (default: every page); the others stay as they are
//   --yes    write; without it, only list which characters would be emptied and what would be made
// The save dir is only read; the out dir must not exist. The new saves are checked before writing (every item
// is kept exactly once, only starting kit is dropped, nothing overlaps, see organizeFiles), written to
// <out dir>.partial and only then renamed to <out dir>. plan.txt there lists every moved item (it is not a save).
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
const inbox = option("--inbox")?.split(",").map(Number);
if (inbox?.some((n) => !Number.isInteger(n) || n < 1)) throw new Error("--inbox takes page numbers, e.g. --inbox 4,5");
const yes = args.includes("--yes");
const [dir, outDir] = args.filter((a) => a !== "--yes");
if (!dir || !outDir) throw new Error("usage: node scripts/organize.mjs <save dir> <out dir> [--mode ...] [--mules a,b] [--yes]");
const partial = `${outDir}.partial`;
if (existsSync(outDir) || existsSync(partial)) throw new Error(`${outDir} or ${partial} already exists`);

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const wasm = await vite.ssrLoadModule("/wasm/pkg/d2_parser.js");
  wasm.initSync({ module: readFileSync(new URL("../wasm/pkg/d2_parser_bg.wasm", import.meta.url)) });
  const { organizeFiles } = await vite.ssrLoadModule("/src/lib/organize.js");
  const { codeOfNumber, labelOf } = await vite.ssrLoadModule("/src/lib/gameData.js");
  const { ownerLabel } = await vite.ssrLoadModule("/src/lib/inventory.js");
  const { describeStats } = await vite.ssrLoadModule("/src/lib/stats.js");
  const { statsOf } = await vite.ssrLoadModule("/src/lib/parseSaves.js");

  const junkText = (m, lang) => describeStats(statsOf(m.item, codeOfNumber(m.item.code)), lang).join("; ");
  const files = readdirSync(dir).filter((f) => /\.d2[si]$/.test(f)).map((name) => ({ name, bytes: new Uint8Array(readFileSync(join(dir, name))) }));
  const { files: changed, saves, report } = organizeFiles(files, wasm, { mode, mules: muleNames, inbox });

  console.log(`mode ${mode}: emptying ${report.mules.length} characters into ${report.newMules.length} mules cloned from ${report.template}`);
  for (const name of report.mules) {
    const c = saves.find((s) => s.name === name).json.character;
    console.log(`  ${name} (${c.class} level ${c.level})`);
  }
  console.log(`${report.moved} items move, ${report.dropped.length} starting items are dropped`);
  console.log("museum (owned / slots):", Object.entries(report.museum).map(([p, m]) => `${p} ${m.owned}/${m.total}`).join("  "));
  console.log(report.newMules.map((m) => `${m.name}:${m.items}`).join(" "));
  const names = (keys) => keys.map((k) => labelOf(k, "en")).join(", ") || "none";
  console.log(`shared stash pages ${inbox?.join(",") ?? "all"} bring: ${report.inbox.museum.length} new to the museum (${names(report.inbox.museum)}),`);
  console.log(`  ${report.inbox.dup.length} duplicates (${names(report.inbox.dup)}), ${report.inbox.trash.length} likely junk, ${report.inbox.other} other`);
  const trash = report.moves.filter((m) => m.group === "TRASH");
  if (trash.length) console.log(`likely junk, to TRASH mules:\n${trash.map((m) => `  ${labelOf(m.key, "en")}: ${junkText(m, "en")}`).join("\n")}`);
  if (!yes) {
    console.log("nothing written; check the characters above and run again with --yes");
    process.exit(0);
  }

  mkdirSync(partial);
  try {
    for (const f of changed) {
      writeFileSync(join(partial, f.name), f.bytes);
      for (const ext of ["ctl", "key", "ma0", "map"]) {
        const from = join(dir, `${f.template}.${ext}`);
        const to = `${f.name.slice(0, -4)}.${ext}`;
        if (f.template && existsSync(from) && !existsSync(join(dir, to))) copyFileSync(from, join(partial, to));
      }
    }
    const plan = report.moves
      .map((m) => {
        const [owner, place] = m.from.split(" ");
        const from = `${ownerLabel(owner, "zh_tw")} ${/^\d+$/.test(place) ? `第${place}頁` : place}`;
        const junk = m.group === "TRASH" ? `\t${junkText(m, "zh_tw")}` : "";
        return [from, labelOf(m.key, "zh_tw"), `→ ${m.to} ${m.page} (${m.x},${m.y})${junk}`].join("\t");
      })
      .sort((a, b) => a.localeCompare(b));
    writeFileSync(join(partial, "plan.txt"), plan.join("\n") + "\n");
    renameSync(partial, outDir);
  } catch (e) {
    rmSync(partial, { recursive: true, force: true });
    throw e;
  }
  console.log(`check passed, ${changed.length} saves written to ${outDir}`);
} finally {
  await vite.close();
}
