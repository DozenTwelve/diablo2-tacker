// Usage: node smoke.mjs <save.d2s|stash.d2i>...
import { readFileSync } from "node:fs";
import { initSync, parseD2s, parseD2i } from "./pkg/d2_parser.js";

initSync({ module: readFileSync(new URL("./pkg/d2_parser_bg.wasm", import.meta.url)) });

let failed = 0;
for (const path of process.argv.slice(2)) {
  try {
    const bytes = readFileSync(path);
    const data = JSON.parse(path.endsWith(".d2i") ? parseD2i(bytes) : parseD2s(bytes));
    console.log("OK  ", path, JSON.stringify(data).length, "chars, keys:", Object.keys(data).join(","));
  } catch (e) {
    failed++;
    console.log("FAIL", path, e.message);
  }
}
process.exit(failed ? 1 : 0);
