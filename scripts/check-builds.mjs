// Check src/data/builds.json: every named item is in the catalog, every text has all languages.
import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { builds, keysOfOption, SLOTS } = await vite.ssrLoadModule("/src/lib/builds.js");
  const CLASSES = ["Amazon", "Sorceress", "Necromancer", "Paladin", "Barbarian", "Druid", "Assassin", "Warlock"];
  const LANGS = ["en", "zh", "zh_tw", "ko"];
  const texts = (o, where) => LANGS.forEach((l) => assert.ok(o?.[l], `${where}: no ${l}`));
  assert.equal(new Set(builds.map((b) => b.id)).size, builds.length, "duplicate build id");
  for (const b of builds) {
    assert.ok(CLASSES.includes(b.cls), `${b.id}: class ${b.cls}`);
    assert.match(b.url, /^https:\/\//, `${b.id}: url`);
    texts(b.name, `${b.id} name`);
    for (const [slot, options] of Object.entries(b.slots)) {
      assert.ok(SLOTS.includes(slot), `${b.id}: slot ${slot}`);
      for (const o of options) {
        const where = `${b.id} ${slot} ${o.item ?? o.text?.en}`;
        if (o.item) {
          const keys = keysOfOption(o);
          assert.ok(keys.length, `${where}: not in the catalog`);
          assert.ok(keys.length === 1 || o.kind, `${where}: several items have this name, add kind`);
        }
        else texts(o.text, where);
        if (o.note) texts(o.note, `${where} note`);
      }
    }
  }
  console.log(`${builds.length} builds ok`);
} finally {
  await vite.close();
}
