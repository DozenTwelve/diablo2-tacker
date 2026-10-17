// Parse D2R save files in the browser with the d2s WASM wrapper (wasm/).
// Output: owners (characters and shared stashes) and a flat list of owned items:
// { key, code, quality, ethereal, sockets, stats, owner, place, x, y, slot, gfx, count }
// (x/y: grid position in stash/inventory/cube; slot: body location when equipped, e.g. "Head";
// gfx: which look a ring, amulet, charm or jewel has),
// stats as [statId, layer, value] (see src/lib/stats.js).
import { codeOfNumber, keyOf } from "./gameData";
import { socketStats } from "./props";

let parser;
async function loadParser() {
  if (!parser) {
    parser = await import("../../wasm/pkg/d2_parser.js");
    await parser.default();
  }
  return parser;
}

function placeOf(item) {
  const { mode, store_page } = item.position;
  if (mode === "Equipped") return "equipped";
  if (mode === "InBelt") return "belt";
  return store_page === "Null" ? mode.toLowerCase() : store_page.toLowerCase();
}

// Item, runeword and socket stats together (runes and gems by gems.txt, jewels their own), summed as in game
function statsOf(item, code) {
  const sockets = item.sockets
    .filter(Boolean)
    .flatMap((s) => (socketStats(code, codeOfNumber(s.code)) ?? s.stats.map((x) => [x.id, x.layer, x.value])).map(([id, layer, value]) => ({ id, layer, value })));
  const sums = new Map();
  for (const { id, layer, value } of [...item.stats, ...(item.runeword_stats ?? []), ...sockets]) {
    const key = `${id}:${layer}`;
    sums.set(key, (sums.get(key) ?? 0) + value);
  }
  return [...sums].map(([key, value]) => [...key.split(":").map(Number), value]);
}

function collect(item, owner, place, out) {
  // Stackable stash tabs keep a slot for every gem/rune type, even when the count is 0
  const count = place === "advanced" ? item.advanced_stash_stack_size : 1;
  if (!count) return;
  const code = codeOfNumber(item.code);
  out.push({
    key: keyOf(item, code),
    code,
    quality: item.quality,
    ethereal: item.flags.includes("ETHEREAL"),
    sockets: item.sockets.length,
    stats: statsOf(item, code),
    owner,
    place,
    x: item.position.inv_x,
    y: item.position.inv_y,
    slot: item.position.mode === "Equipped" ? item.position.body_location : undefined,
    gfx: item.variable_gfx_id ?? undefined,
    count,
  });
  // Runes inside a runeword are part of it, not loose runes
  if (item.runeword_id == null) item.sockets.forEach((s) => s && collect(s, owner, "socketed", out));
}

export async function parseSaveFiles(files) {
  const { parseD2s, parseD2i } = await loadParser();
  const items = [];
  const owners = []; // { name, cls?, level? }; shared stashes have no class
  const errors = [];
  const saves = files.filter((f) => /\.d2[si]$/i.test(f.name));
  for (const file of saves) {
    const owner = file.name.replace(/\.d2[si]$/i, "");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (/\.d2i$/i.test(file.name)) {
        JSON.parse(parseD2i(bytes)).forEach((tab, i) => {
          const place = tab.tab_type === "AdvancedStash" ? "advanced" : `shared${i + 1}`;
          tab.items.forEach((it) => collect(it, owner, place, items));
        });
        owners.push({ name: owner });
      } else {
        const save = JSON.parse(parseD2s(bytes));
        save.items.forEach((it) => collect(it, owner, placeOf(it), items));
        (save.merc_items?.items ?? []).forEach((it) => collect(it, owner, "merc", items));
        owners.push({ name: owner, cls: save.character.class, level: save.character.level });
      }
    } catch (e) {
      errors.push(`${file.name}: ${e.message ?? e}`);
    }
  }
  return { items, owners, errors, files: saves.length, loadedAt: new Date().toISOString() };
}
