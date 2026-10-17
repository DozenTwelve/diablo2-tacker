// Parse D2R save files in the browser with the d2s WASM wrapper (wasm/).
// Output is a flat list of owned items: { key, code, quality, ethereal, sockets, owner, place, count }.
import { codeOfNumber, keyOf } from "./gameData";

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
    owner,
    place,
    count,
  });
  // Runes inside a runeword are part of it, not loose runes
  if (item.runeword_id == null) item.sockets.forEach((s) => s && collect(s, owner, "socketed", out));
}

export async function parseSaveFiles(files) {
  const { parseD2s, parseD2i } = await loadParser();
  const items = [];
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
      } else {
        const save = JSON.parse(parseD2s(bytes));
        save.items.forEach((it) => collect(it, owner, placeOf(it), items));
        save.merc_items.items.forEach((it) => collect(it, owner, "merc", items));
      }
    } catch (e) {
      errors.push(`${file.name}: ${e.message ?? e}`);
    }
  }
  return { items, errors, files: saves.length, loadedAt: new Date().toISOString() };
}
