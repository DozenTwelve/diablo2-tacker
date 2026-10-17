# Steam Deck plugin

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin: open the tracker from the quick access
menu in Game Mode, with the saves read straight from the Deck.

- `main.py` and `py_modules/tracker.py`: the backend. It serves the web app (built with `VITE_DECK=1`), the save files
  and the item icons on `127.0.0.1:18565`, only while the plugin is loaded. It runs as the `deck` user, not root.
- `src/index.tsx`: the quick access panel. "Open collection" opens the tracker in Steam's browser. "Get item icons"
  pulls the inventory icons out of the player's own game files with [casc-cli](https://github.com/ironsp4rk/casc-cli)
  (MIT) and turns them into PNGs in Decky's data folder; the plugin ships no game art.

## Build and install

```bash
cd decky && npm install && ./pack.sh     # -> decky/out/d2r-collection-tracker.zip
```

Copy the zip to the Deck. In Game Mode: Decky (quick access menu) → settings → General → enable Developer mode,
then Developer → Install Plugin from ZIP file, and pick the zip. Open the plugin and press "Get item icons" once
(about a minute), then "Open collection".

`python3 test_tracker.py [sprite dir]` checks the backend on any computer.
