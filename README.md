# Diablo II: Resurrected Collection Tracker

Load your D2R save folder and see everything you own: which character or stash page holds each item,
how many copies, and which uniques, sets, runewords and runes you are still missing.
Supports Reign of the Warlock saves. Names in Traditional and Simplified Chinese plus English.

Saves are parsed in the browser (WebAssembly) and never uploaded.

### Live Site

- [https://d2r.diamonddoge.org/](https://d2r.diamonddoge.org/)

## How it works

- `wasm/` wraps [d2s](https://github.com/ResurrectedTrader/d2s-rs) (MIT) to parse `.d2s` character saves
  and `.d2i` shared stashes. The built package in `wasm/pkg/` is committed so deploys need no Rust.
- `scripts/gen-data.mjs` builds `src/data/*.json` from the official game tables and string files,
  extracted from the game's CASC storage (e.g. with [casc-cli](https://github.com/ironsp4rk/casc-cli)).
  Raw game files are not committed.
- `src/lib/` holds the logic (parsing saves, item lookups, translations), `src/components/` the UI.

## Development

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run gen:data [dir]` | Regenerate item data from extracted game files (default `~/Projects/Diablo2/d2r-gamedata`) |
| `npm run build:wasm` | Rebuild the save parser (needs Rust, the `wasm32-unknown-unknown` target and `wasm-pack`) |
| `node scripts/check-saves.mjs <save dir>` | Parse a save folder with the app's code and print a summary |
| `node scripts/organize.mjs <save dir> <out dir>` | Rearrange level 1 mules and shared stash pages into numbered Barbarian mules; writes only the changed saves to a new folder |
