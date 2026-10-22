// Check every catalog property (uniques, set items, set bonuses, runewords) turns into shown text,
// so items nobody owns yet still describe right. Prints the property codes that show nothing, besides
// those the game doesn't show either (durability, visual states, length of poison/cold damage...).
// Also: per-level values show (not "+0/Lv"), and a stat summing to 0 from two sources shows nothing.
// Usage: node scripts/check-props.mjs   (exit code 1 when some property shows nothing)
import assert from "node:assert/strict";
import { createServer } from "vite";

// Not shown in game, commented out in the tables (*), or one item's special random/affix property
const NOT_SHOWN = new Set(["dur", "state", "bloody", "fade", "pois-len", "cold-len", "*hp", "*enr", "*charged", "roguesbow-affix1", "magdam-rand", "skilltab-war"]);

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { uniques, sets, runewords } = await vite.ssrLoadModule("/src/lib/gameData.js");
  const { propLines } = await vite.ssrLoadModule("/src/lib/props.js");
  const { describeStats } = await vite.ssrLoadModule("/src/lib/stats.js");

  const all = [
    ...uniques.filter((u) => !u.legacy).map((u) => [u.en, u.props, u.lvl]),
    ...sets.flatMap((s) => [
      [`${s.en} (full)`, s.full],
      ...s.bonus.map(([n, props]) => [`${s.en} (${n})`, props]),
      ...s.items.flatMap((i) => [[i.en, i.props], ...i.bonus.map(([n, props]) => [`${i.en} (${n})`, props])]),
    ]),
    ...runewords.map((w) => [w.en, w.props]),
  ];
  const silent = new Map(); // property code -> items where it shows nothing
  let count = 0;
  for (const [name, props, lvl] of all) {
    for (const line of propLines(props, "en", lvl)) assert(!line.includes("+0/"), `${name}: ${line}`);
    for (const prop of props) {
      count++;
      if (NOT_SHOWN.has(prop[0]) || propLines([prop], "zh_tw", lvl).length) continue;
      if (!silent.has(prop[0])) silent.set(prop[0], []);
      silent.get(prop[0]).push(name);
    }
  }
  console.log(`${all.length} entries, ${count} properties`);
  assert.deepEqual(describeStats([[89, 0, -1], [89, 0, 1]], "en"), []); // Malice's light radius with El in it
  for (const [code, names] of [...silent].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${code}: ${names.length} (${names.slice(0, 4).join(", ")})`);
  }
  process.exitCode = silent.size ? 1 : 0;
} finally {
  await vite.close();
}
