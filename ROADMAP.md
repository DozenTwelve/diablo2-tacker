# Roadmap

Planned work, roughly in order. Nothing here is started yet.

## 1. Load speed (done)

- Build assets are cached for a year and item icons for 30 days (`public/_headers`, read by Netlify and Cloudflare Pages).
- Not done, measured first: every page, starting with search, needs the whole catalog (about 190 kB gzipped with React), so
  splitting the data per page saves little. Item icons already load lazily. A parsed save folder takes about 200 bytes per
  item in localStorage (1,052 items: 215 kB), far from its ~5 MB limit, and the app already keeps working when storage is
  full, so IndexedDB can wait until someone hits it.

## 2. Getting saves in and out

Guides for finding saves and putting changed ones back, later also as an agent skill in this repo:

- **PC**: `C:\Users\<you>\Saved Games\Diablo II Resurrected\`.
- **Steam Deck**: D2R runs through Battle.net added as a non-Steam game, so the Proton prefix has a different id on every Deck: `~/.local/share/Steam/steamapps/compatdata/<id>/pfx/drive_c/users/steamuser/Saved Games/Diablo II Resurrected/`. Cover copying from desktop mode to another device and back.

Consoles are out of scope.

## 3. Organizing other players' stashes

`scripts/organize.mjs` works for one game mode at a time, lists which characters it would empty and writes only with `--yes`. Before others use it:

- Explain the result first, in plain words: how many mules it makes, which items go where, that starting kit is dropped, and that mules are numbered (`UW-A`, `SET-A`...) with fixed slots for uniques and set items.
- Ask for a backup, then hand back the new saves to copy into the save folder (also an agent skill).
- Expect stashes far messier than a tidy set of mules.

## 4. Keeping it organized

Players drop new finds into the shared stash and come back later:

- **Inbox pages**: the player picks which shared stash pages are an inbox. Only those, plus the mules, are reorganized; other pages are working sets for main characters (charms, for example) and stay as they are.
- Uniques and set items go to their museum slots, or to the duplicates mule; everything else is regrouped, adding mules (`AA`, `AB`...) as groups grow.
- **To clean**: likely junk magic and rare items (by rules, such as a single low roll on a jewel) gathered in one place for the player to delete. Nothing is deleted automatically.
- **Report** after each run: new museum items, new duplicates, items waiting to be cleaned.

## 5. Steam Deck plugin

A [Decky Loader](https://github.com/SteamDeckHomebrew) plugin, so Deck players see their collection in Game Mode without exporting anything:

- Reuse the React UI, with full-screen pages for the collection and mules.
- The backend reads saves straight from the Proton prefix, using the parser as a native Linux binary or the WASM build.
- Extract item icons from the game files on the player's own Deck; the plugin ships no Blizzard art.
- Before writing saves: check the game is not running, back up, and verify the result.

## Deployment

Move from Netlify to Cloudflare Pages: build locally (with the generated icons) and upload with `wrangler pages deploy dist`. Icons stay out of git. Cloudflare Pages serves `index.html` for unknown paths when the build has no `404.html`, which the router needs; `public/_redirects` is only for Netlify and can go.
