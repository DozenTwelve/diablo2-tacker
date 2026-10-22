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
  const { copiesNeeded, muleTimes, organizeFiles } = await vite.ssrLoadModule("/src/lib/organize.js");
  const { scoreOfItem } = await vite.ssrLoadModule("/src/lib/parseSaves.js");

  const parse = (name, bytes) => JSON.parse(name.endsWith(".d2s") ? wasm.parseD2s(bytes) : wasm.parseD2i(bytes));
  const write = (name, json) => (name.endsWith(".d2s") ? wasm.writeD2s : wasm.writeD2i)(JSON.stringify(json));
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
  check("organizing again changes nothing, and hands back nothing", () => {
    const again = run(organized).files;
    assert.deepEqual(again.map((f) => f.name), []);
  });

  check("the museum holds the best copy; the others go to DUP", () => {
    const museum = new Map(first.report.moves.filter((m) => m.group === "MUSEUM").map((m) => [m.key, m.item]));
    const eth = (item) => item.flags.includes("ETHEREAL");
    let compared = 0;
    for (const m of first.report.moves.filter((m) => m.group === "DUP" && museum.has(m.key))) {
      const kept = museum.get(m.key);
      if (eth(kept) && !eth(m.item)) throw new Error(`${m.key}: an ethereal copy in the museum, a plain one in DUP`);
      if (eth(kept) === eth(m.item)) {
        assert((scoreOfItem(kept) ?? -1) >= (scoreOfItem(m.item) ?? -1), `${m.key}: a better copy is in DUP`);
        compared++;
      }
    }
    if (!compared) console.log("--  no duplicate to compare in these saves");
  });

  check("extra copies past what builds need go to TRASH, the lowest rolls first", () => {
    const eth = (item) => item.flags.includes("ETHEREAL");
    const byKey = new Map();
    for (const m of first.report.moves.filter((m) => /^[us]:/.test(m.key) && ["MUSEUM", "DUP", "TRASH"].includes(m.group))) {
      if (!byKey.has(m.key)) byKey.set(m.key, []);
      byKey.get(m.key).push(m);
    }
    let trashed = 0;
    for (const [key, list] of byKey) {
      const museum = list.find((m) => m.group === "MUSEUM");
      if (!museum) continue;
      const plain = list.filter((m) => m.group === "DUP" && !eth(m.item));
      assert(plain.length <= Math.max(0, copiesNeeded(key) - (eth(museum.item) ? 0 : 1)), `${key}: too many kept`);
      for (const t of list.filter((m) => m.group === "TRASH" && !eth(m.item))) {
        trashed++;
        assert(plain.length === Math.max(0, copiesNeeded(key) - (eth(museum.item) ? 0 : 1)), `${key}: trashed while short`);
        for (const k of plain) assert((scoreOfItem(k.item) ?? -1) >= (scoreOfItem(t.item) ?? -1), `${key}: a better copy trashed`);
      }
    }
    if (!trashed) console.log("--  no extra copies past need in these saves");
    assert(copiesNeeded("u:Harlequin Crest") > 1 && copiesNeeded("u:Bul-Kathos' Wedding Band") >= 2);
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
    // Over the whole folder as organized: saves that come out unchanged are not handed back
    const mulesGold = (folder) => gold(folder.filter((f) => r.report.mules.includes(f.name.slice(0, -4)) || r.report.newMules.some((m) => `${m.name}.d2s` === f.name)));
    assert.equal(mulesGold(after(files, r.files)), mulesGold(base) + 12345);
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

  check("a mule named in other case never gets a second file", () => {
    const name = first.report.newMules[0].name;
    const lower = organized.map((f) => (f.name === `${name}.d2s` ? { ...f, name: `${name.toLowerCase()}.d2s` } : f));
    const names = run(lower).files.map((f) => f.name);
    // Unchanged, it isn't handed back at all; above all never as a second file under the layout's spelling
    assert(!names.includes(`${name}.d2s`));
  });

  check("an emptied mule with one of our own names (CHARM-B) is not offered for deletion", () => {
    // The organized folder plus a spare mule named like the layout's, which nothing goes into
    const spare = organized.find((f) => f.name === a) ?? organized.find((f) => f.name.endsWith(".d2s"));
    const files = [...organized, { ...spare, name: "CHARM-ZZ.d2s" }];
    const r = run(files);
    assert(r.report.mules.includes("CHARM-ZZ") && !r.report.leftEmpty.includes("CHARM-ZZ"));
  });

  check("every mule after the run is listed, and dated below the other characters in D2R's list", () => {
    const names = first.report.muleNames;
    assert(first.report.newMules.every((m) => names.some((n) => n.toLowerCase() === m.name.toLowerCase())));
    assert(first.report.mules.every((n) => names.includes(n)));
    const times = { "Main.d2s": 2_000_000, "Old.d2s": 1_000_000, ...Object.fromEntries(names.map((n) => [`${n}.d2s`, 9_000_000])) };
    const order = muleTimes(times, names);
    assert(Object.values(order).every((ms) => ms < 1_000_000) && Object.keys(order).length === names.length);
    assert.deepEqual(muleTimes({ "A.d2s": 5 }, ["A"]), {}); // only mules: nothing to go below
  });

  check("a mistyped mule name or a missing inbox page stops the run", () => {
    assert.throws(() => run(base, { mules: [first.report.mules[0], "NoSuchMule"] }), /NoSuchMule/);
    assert.throws(() => run(base, { inbox: [99] }), /no page 99/);
  });
} finally {
  await vite.close();
}
