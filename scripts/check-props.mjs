// Check every catalog property (uniques, set items, set bonuses, runewords) turns into shown text,
// so items nobody owns yet still describe right. Prints the property codes that show nothing, besides
// those the game doesn't show either (durability, visual states, length of poison/cold damage...).
// Usage: node scripts/check-props.mjs   (exit code 1 when some property shows nothing)
import { createServer } from "vite";

// Not shown in game, commented out in the tables (*), or one item's special random/affix property
const NOT_SHOWN = new Set(["dur", "state", "bloody", "fade", "pois-len", "cold-len", "*hp", "*enr", "*charged", "roguesbow-affix1", "magdam-rand", "skilltab-war"]);

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { uniques, sets, runewords } = await vite.ssrLoadModule("/src/lib/gameData.js");
  const { propLines } = await vite.ssrLoadModule("/src/lib/props.js");

  const all = [
    ...uniques.filter((u) => !u.legacy).map((u) => [u.en, u.props]),
    ...sets.flatMap((s) => [
      [`${s.en} (full)`, s.full],
      ...s.bonus.map(([n, props]) => [`${s.en} (${n})`, props]),
      ...s.items.flatMap((i) => [[i.en, i.props], ...i.bonus.map(([n, props]) => [`${i.en} (${n})`, props])]),
    ]),
    ...runewords.map((w) => [w.en, w.props]),
  ];
  const silent = new Map(); // property code -> items where it shows nothing
  let count = 0;
  for (const [name, props] of all) {
    for (const prop of props) {
      count++;
      if (NOT_SHOWN.has(prop[0]) || propLines([prop], "zh_tw").length) continue;
      if (!silent.has(prop[0])) silent.set(prop[0], []);
      silent.get(prop[0]).push(name);
    }
  }
  console.log(`${all.length} entries, ${count} properties`);
  for (const [code, names] of [...silent].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${code}: ${names.length} (${names.slice(0, 4).join(", ")})`);
  }
  process.exitCode = silent.size ? 1 : 0;
} finally {
  await vite.close();
}
