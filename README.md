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
| `node scripts/gen-images.mjs [dir]` | Convert the game's inventory icons (`data/hd/global/ui/items/*.sprite`) to `public/items/*.webp` (git-ignored: Blizzard art stays out of the repo) |
| `npm run build:wasm` | Rebuild the save parser (needs Rust, the `wasm32-unknown-unknown` target and `wasm-pack`) |
| `node scripts/check-saves.mjs <save dir>` | Parse a save folder with the app's code and print a summary |
| `node scripts/check-props.mjs` | Check every catalog property (uniques, sets, runewords) shows as text |
| `node scripts/organize.mjs <save dir> <out dir> [--mode SoftCore:Modern] [--mules a,b] [--yes]` | Rearrange mules (level 1 characters, or the named ones) of one game mode into numbered mules; lists what it would do, writes only with `--yes`, to a new folder, after checking every item is kept |
