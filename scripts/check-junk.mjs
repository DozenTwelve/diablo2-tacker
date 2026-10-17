// Check the likely-junk rules in src/lib/organize.js on made-up items.
import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { isJunk } = await vite.ssrLoadModule("/src/lib/organize.js");
  // stats as in the save JSON; life (7) is stored shifted by 8
  const item = (quality, ...stats) => ({ quality, stats: stats.map(([id, value]) => ({ id, layer: 0, value })) });
  const life = (n) => [7, n << 8];
  assert.equal(isJunk(item("Magic", life(10)), "cm1"), true, "small charm, low life");
  assert.equal(isJunk(item("Magic", life(20)), "cm1"), false, "small charm, good life");
  assert.equal(isJunk(item("Magic", life(10), [39, 11]), "cm1"), false, "one good stat keeps it");
  assert.equal(isJunk(item("Magic", [39, 5], [41, 5], [43, 5], [45, 5]), "cm1"), false, "all resistances +5");
  assert.equal(isJunk(item("Magic", [107, 1]), "cm3"), false, "unlisted stat (skills) keeps it");
  assert.equal(isJunk(item("Rare", life(1)), "cm1"), false, "only magic items");
  assert.equal(isJunk(item("Magic", [79, 20]), "jew"), true, "jewel, gold find only");
  assert.equal(isJunk(item("Magic", [79, 20]), "rin"), false, "not rings");
  console.log("junk rules ok");
} finally {
  await vite.close();
}
