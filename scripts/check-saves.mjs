// Run the app's save parsing on a local save folder and print a summary.
// Usage: node scripts/check-saves.mjs <save dir>   (exit code 1 on parse errors or unmatched items)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/check-saves.mjs <save dir>");

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  // Node can't fetch the .wasm by URL, so init the shared module instance with the bytes first
  const wasm = await vite.ssrLoadModule("/wasm/pkg/d2_parser.js");
  wasm.initSync({ module: readFileSync(new URL("../wasm/pkg/d2_parser_bg.wasm", import.meta.url)) });
  const { parseSaveFiles } = await vite.ssrLoadModule("/src/lib/parseSaves.js");
  const { catalog, labelOf } = await vite.ssrLoadModule("/src/lib/gameData.js");
  const { groupByKey, totalCount, locationLines } = await vite.ssrLoadModule("/src/lib/inventory.js");

  const files = readdirSync(dir).map((name) => new File([readFileSync(join(dir, name))], name));
  const { items, errors, files: n } = await parseSaveFiles(files);
  const owned = groupByKey(items);

  const kinds = {};
  for (const key of owned.keys()) kinds[key[0]] = (kinds[key[0]] ?? 0) + 1;
  console.log(`${n} saves, ${items.length} items, distinct keys by kind:`, kinds);
  for (const kind of ["Unique", "Set", "runewords", "runes"]) {
    const keys = [...catalog].filter(([, e]) => e.kind === kind && !e.legacy).map(([k]) => k);
    console.log(`${kind}: ${keys.filter((k) => owned.has(k)).length} / ${keys.length}`);
  }
  // Uniques/sets that fell through to a base key mean the id lookup is wrong
  const unmatched = items.filter((i) => i.key.startsWith("b:") && /^(Unique|Set)$/.test(i.quality));
  for (const key of ["r:r30", "b:cm3:Magic", "b:jew:Magic"]) {
    if (!owned.has(key)) continue;
    console.log(`${labelOf(key, "zh_tw")} ×${totalCount(owned.get(key))}`);
    locationLines(owned.get(key), "zh_tw").forEach((l) => console.log(`  ${l.text} ×${l.count}`));
  }
  errors.forEach((e) => console.log("ERROR", e));
  unmatched.forEach((i) => console.log("UNMATCHED", i.key, i.owner));
  process.exitCode = errors.length || unmatched.length ? 1 : 0;
} finally {
  await vite.close();
}
