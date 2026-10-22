// Regression checks for src/lib/organize.js on a real save folder: each case changes a copy of the saves in
// memory (the folder is only read) and organizes it.
// Usage: node scripts/check-organize.mjs <save dir>   (needs two or more level 1 mules in SoftCore:Modern)
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/check-organize.mjs <save dir>");

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
try {
  const wasm = await vite.ssrLoadModule("/wasm/pkg/d2_parser.js");
  wasm.initSync({ module: readFileSync(new URL("../wasm/pkg/d2_parser_bg.wasm", import.meta.url)) });
  const { organizeFiles } = await vite.ssrLoadModule("/src/lib/organize.js");

  const parse = (name, bytes) => JSON.parse(name.endsWith(".d2s") ? wasm.parseD2s(bytes) : wasm.parseD2i(bytes));
  const write = (name, json) => (name.endsWith(".d2s") ? wasm.writeD2s : wasm.writeD2i)(JSON.stringify(json));
  const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const base = readdirSync(dir).filter((f) => /\.d2[si]$/.test(f)).map((name) => ({ name, bytes: new Uint8Array(readFileSync(join(dir, name))) }));
  const run = (files, options) => organizeFiles(files, wasm, options);
  const json = (files, name) => parse(name, files.find((f) => f.name === name).bytes);
  // The folder with save `name` changed, written as `as` (a second file when the names differ)
  const edit = (files, name, change, as = name) => {
    const j = json(files, name);
    change(j);
    return [...files.filter((f) => f.name !== as), { name: as, bytes: write(as, j) }];
  };
  const after = (files, out) => [...files.filter((f) => !out.some((o) => o.name === f.name)), ...out];
  const check = (what, fn) => (fn(), console.log(`ok  ${what}`));

  const first = run(base);
  const [a, b] = first.report.mules.map((n) => `${n}.d2s`);
  assert(b, "needs two or more level 1 mules in SoftCore:Modern");
  const allItems = base.filter((f) => f.name.endsWith(".d2s")).flatMap((f) => json(base, f.name).items);
  const gold = (out) => out.filter((f) => f.name.endsWith(".d2s")).reduce((n, f) => n + parse(f.name, f.bytes).stats.filter((s) => s.id === 14 || s.id === 15).reduce((m, s) => m + s.value, 0), 0);

  const organized = after(base, first.files);
  check("organizing again changes nothing", () => {
    for (const f of run(organized).files) assert(equal(f.bytes, organized.find((o) => o.name === f.name).bytes), `${f.name} changed`);
  });

  const runeword = allItems.find((i) => i.quality === "Normal" && i.runeword_id != null);
  if (runeword) {
    check("a white hand axe made into a runeword is kept, not dropped as starting kit", () => {
      const hax = [..."hax "].reduce((n, c, i) => n + (c.charCodeAt(0) << (8 * i)), 0) >>> 0;
      const axe = { ...structuredClone(runeword), code: hax, position: { ...runeword.position, mode: "Stored", body_location: "None", store_page: "Inventory", inv_x: 0, inv_y: 0 } };
      const r = run(edit(base, a, (j) => j.items.push(axe)));
      assert.equal(r.report.dropped.length, first.report.dropped.length);
    });
  } else console.log("--  no runeword in a white base in these saves: starting kit check skipped");

  check("gold on a mule stays, and the mule is not offered for deletion", () => {
    const files = edit(base, a, (j) => j.stats.push({ id: 14, layer: 0, value: 12345 }));
    const r = run(files);
    assert.equal(gold(r.files), gold(base.filter((f) => first.report.mules.includes(f.name.slice(0, -4)))) + 12345);
    assert(!r.report.leftEmpty.includes(a.slice(0, -4)));
  });

  check("a mule with items on its corpse is refused", () => {
    const files = edit(base, a, (j) => (j.corpses = [{ unused: 0, x: 0, y: 0, items: [structuredClone(allItems[0])] }]));
    assert.throws(() => run(files), /corpse/);
  });

  check("dead hardcore characters are never mules, named or not", () => {
    // In the organized folder, so new mule names (as hardcore: HUW-A...) match the dead mules' own
    let files = organized.map((f) => (/^[A-Z]+-[A-Z]+\.d2s$/.test(f.name) ? { ...f, name: `H${f.name}` } : f));
    const names = files.filter((f) => /^H[A-Z]+-[A-Z]+\.d2s$/.test(f.name)).map((f) => f.name);
    const alive = names.find((n) => n.startsWith("HTRASH")) ?? names.at(-1);
    for (const name of names) files = edit(files, name, (j) => (j.character.flags = name === alive ? "HARDCORE" : "HARDCORE | DEAD"));
    // Left alone by default: their names are taken by other characters, which stops the run
    assert.throws(() => run(files, { mode: "HardCore:Modern" }), /already used by other characters/);
    assert.throws(() => run(files, { mode: "HardCore:Modern", mules: names.map((n) => n.slice(0, -4)) }), /already used by other characters/);
  });

  check("a classic character is not a legacy mule", () => {
    let files = base;
    for (const name of first.report.mules.map((n) => `${n}.d2s`))
      files = edit(files, name, (j) => (j.character.preview.game_version = name === a ? "Classic" : "Expansion"));
    assert(!run(files, { mode: "SoftCore:Legacy" }).report.mules.includes(a.slice(0, -4)));
  });

  const stash = base.find((f) => f.name === "ModernSharedStashSoftCoreV2.d2i");
  if (stash) {
    check("a copy of the shared stash is not emptied", () => {
      const copy = "ModernSharedStashSoftCoreV2 - Copy.d2i";
      const r = run(edit(base, stash.name, (j) => j.find((tab) => tab.tab_type === "Normal").items.push(structuredClone(allItems[0])), copy));
      assert.equal(r.report.moved, first.report.moved);
    });
  }

  check("two saves named apart from case stop the run", () => {
    assert.throws(() => run([...base, { ...base.find((f) => f.name === a), name: a.toLowerCase() }]), /upper and lower case/);
  });

  check("a mule named in other case is rewritten under its own name", () => {
    const name = first.report.newMules[0].name;
    const lower = organized.map((f) => (f.name === `${name}.d2s` ? { ...f, name: `${name.toLowerCase()}.d2s` } : f));
    const names = run(lower).files.map((f) => f.name);
    assert(names.includes(`${name.toLowerCase()}.d2s`) && !names.includes(`${name}.d2s`));
  });

  check("a mistyped mule name or a missing inbox page stops the run", () => {
    assert.throws(() => run(base, { mules: [first.report.mules[0], "NoSuchMule"] }), /NoSuchMule/);
    assert.throws(() => run(base, { inbox: [99] }), /no page 99/);
  });
} finally {
  await vite.close();
}
