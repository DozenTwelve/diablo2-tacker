// Regression checks for src/lib/parseSaves.js on a real save folder: each case changes a copy of the saves in
// memory (the folder is only read) and reads it as the site does.
// Usage: node scripts/check-parse.mjs <save dir>   (needs a character holding items and a ModernSharedStash file)
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/check-parse.mjs <save dir>");

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
try {
  const wasm = await vite.ssrLoadModule("/wasm/pkg/d2_parser.js");
  wasm.initSync({ module: readFileSync(new URL("../wasm/pkg/d2_parser_bg.wasm", import.meta.url)) });
  const { parseSaveFiles } = await vite.ssrLoadModule("/src/lib/parseSaves.js");
  const { catalog } = await vite.ssrLoadModule("/src/lib/gameData.js");
  const { findsOf, inboxItems } = await vite.ssrLoadModule("/src/lib/newItems.js");
  const { rollScore } = await vite.ssrLoadModule("/src/lib/props.js");

  const base = readdirSync(dir).filter((f) => /\.d2[si]$/.test(f)).map((name) => ({ name, bytes: new Uint8Array(readFileSync(join(dir, name))) }));
  const read = (files) => parseSaveFiles(files.map((f) => new File([f.bytes], f.name)));
  const replace = (name, bytes) => [...base.filter((f) => f.name !== name), { name, bytes }];
  const change = (name, fn) => {
    const json = JSON.parse(wasm.parseD2s(base.find((f) => f.name === name).bytes));
    fn(json);
    return replace(name, wasm.writeD2s(JSON.stringify(json)));
  };
  const check = async (what, fn) => (await fn(), console.log(`ok  ${what}`));

  const first = await read(base);
  assert.deepEqual(first.errors, []);
  const holder = first.owners.find((o) => o.cls && first.items.some((i) => i.owner === o.name && i.place !== "socketed"));
  const held = (data) => data.items.filter((i) => i.owner === holder.name).length;

  await check("runewords keep their own rolls apart from their runes' bonuses (the roll score)", async () => {
    const words = first.items.filter((i) => i.key.startsWith("w:"));
    for (const r of words) assert(r.rolls, `${r.key} has no rolls`);
    // stats add the runes' bonuses and the base's own on top
    assert(!words.length || words.some((r) => JSON.stringify(r.rolls) !== JSON.stringify(r.stats)));
  });

  const facets = first.items.filter((i) => i.key === "u:Rainbow Facet");
  if (facets.length) {
    await check("a Rainbow Facet is scored against its own version", async () => {
      const { variants } = catalog.get("u:Rainbow Facet").names;
      for (const r of facets) assert(variants[r.variant] && rollScore(r, variants[r.variant]) != null, `version ${r.variant}`);
    });
  } else console.log("--  no Rainbow Facet in these saves: version check skipped");

  await check("a backup kept in a subfolder of the picked folder is not counted again", async () => {
    // As a folder pick gives them: every file with its path from the picked folder
    const at = (path, f) => Object.defineProperty(new File([f.bytes], f.name), "webkitRelativePath", { value: `${path}/${f.name}` });
    const data = await parseSaveFiles([...base.map((f) => at("saves", f)), ...base.map((f) => at("saves/backup", f))]);
    assert.equal(data.items.length, first.items.length);
    assert.equal(data.skipped, base.length);
  });

  const stash = first.owners.find((o) => !o.cls && o.mode === "SoftCore:Modern");
  const inMuseum = first.items.find((r) => /^(UW|UA|UJ|SET)-/.test(r.owner) && /^[us]:/.test(r.key));
  if (!stash || !inMuseum) console.log("--  no museum mules in these saves: new finds check skipped");
  else
    await check("a find's verdict is where organizing puts it", async () => {
      const find = (r, page = 9) => ({ ...r, owner: stash.name, place: `shared${page}` });
      const verdictOf = (data, r) => findsOf(data, { [stash.mode]: [9] }).find((f) => f.r === r).verdict;
      // A copy of what the museum holds: better rolls swap in, else a duplicate kept or extra
      const copy = find(inMuseum);
      const data = { ...first, items: [...first.items, copy] };
      assert.deepEqual(inboxItems(data, { [stash.mode]: [9] }), [copy]);
      assert.deepEqual(inboxItems(data, { [stash.mode]: 9 }), []); // a stored value that isn't a list
      assert(["upgrade", "needed", "extra"].includes(verdictOf(data, copy).kind));
      // Nothing like it anywhere: new
      const missing = [...catalog].find(([key, e]) => key.startsWith("u:") && !e.legacy && !first.items.some((r) => r.key === key));
      const fresh = find({ key: missing[0], code: missing[1].names.code, quality: "Unique", stats: [], ethereal: false, owner: "", place: "" });
      assert.equal(verdictOf({ ...first, items: [...first.items, fresh] }, fresh).kind, "new");
      // A copy on a main doesn't count: what organizing doesn't take can't change the verdict
      const main = first.owners.find((o) => o.cls && o.level > 1);
      const onMain = { ...inMuseum, owner: main.name, place: "stash" };
      assert.deepEqual(verdictOf({ ...first, items: [...first.items, copy, onMain] }, copy), verdictOf(data, copy));
    });

  await check("a shared stash cut short is reported", async () => {
    // Cut at the end of a page: the parser reads the pages before it and stops without an error
    const stash = base.find((f) => f.name === "ModernSharedStashSoftCoreV2.d2i");
    const pages = (bytes) => {
      try {
        return JSON.parse(wasm.parseD2i(bytes)).length;
      } catch {
        return null;
      }
    };
    const whole = pages(stash.bytes);
    let cut = stash.bytes.length - 1;
    const fewer = (n) => n != null && n < whole;
    while (cut > 0 && !fewer(pages(stash.bytes.slice(0, cut)))) cut--;
    assert(cut > 0, "no page boundary to cut at");
    const data = await read(replace(stash.name, stash.bytes.slice(0, cut)));
    assert(data.errors.some((e) => e.includes("cut short")), data.errors.join("\n"));
  });

  await check("macOS ._ files are not saves", async () => {
    const data = await read([...base, { name: "._UW-A.d2s", bytes: new Uint8Array(4096) }]);
    assert.equal(data.files, first.files);
    assert.deepEqual(data.errors, []);
  });

  await check("items on a corpse count", async () => {
    const data = await read(change(`${holder.name}.d2s`, (j) => (j.corpses = [{ unused: 0, x: 0, y: 0, items: [structuredClone(j.items[0])] }])));
    assert(data.items.some((i) => i.owner === holder.name && i.place === "corpse"));
  });

  await check("a dead hardcore hero's items don't count", async () => {
    const data = await read(change(`${holder.name}.d2s`, (j) => (j.character.flags = "HARDCORE | DEAD")));
    assert.equal(held(data), 0);
    assert(data.owners.find((o) => o.name === holder.name).dead);
    assert(held(first) > 0);
  });
} finally {
  await vite.close();
}
