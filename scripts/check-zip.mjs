// Check src/lib/zip.js output with Python's zipfile (macOS unzip ignores the UTF-8 name flag).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zip } from "../src/lib/zip.js";

const dir = mkdtempSync(join(tmpdir(), "zip-"));
try {
  const files = [
    { name: "UW-A.d2s", bytes: new Uint8Array(1000).map((_, i) => i * 7), time: new Date(2026, 9, 17, 21, 5, 42).getTime() },
    { name: "說明.txt", bytes: new TextEncoder().encode("放回存檔資料夾\n") },
    { name: "empty.key", bytes: new Uint8Array(0) },
  ];
  writeFileSync(join(dir, "out.zip"), zip(files));
  const read = `import json, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
print(json.dumps({i.filename: [list(z.read(i)), i.date_time] for i in z.infolist()}))`;
  const got = JSON.parse(execFileSync("python3", ["-I", "-c", read, join(dir, "out.zip")]));
  assert.deepEqual(Object.keys(got), files.map((f) => f.name));
  for (const f of files) assert.deepEqual(got[f.name][0], [...f.bytes], f.name);
  // Each file keeps its time (D2R lists characters by it), in 2 second steps; none: 1980-01-01
  assert.deepEqual(got["UW-A.d2s"][1], [2026, 10, 17, 21, 5, 42]);
  assert.deepEqual(got["empty.key"][1], [1980, 1, 1, 0, 0, 0]);
  console.log("zip ok");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
