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
