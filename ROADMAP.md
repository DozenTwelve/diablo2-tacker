# Roadmap

Planned work, roughly in order.

## 1. Load speed (done)

- Build assets are cached for a year and item icons for 30 days (`public/_headers`, read by Cloudflare Pages).
- Fonts were most of the download: Google Fonts sends Noto Serif SC in ~100 slices and the item names touch most of
  them (2.5 MB on the welcome page, 5.4 MB on the uniques page). `scripts/gen-fonts.py` cuts it to the ~2,000
  characters the app uses, one 805 kB file served with the build (so the Deck plugin works offline too); rerun it after
  new Chinese text, `--check` lists what is missing. The favicon (264 kB, now 8 kB) and the background (241 kB, now
  97 kB) were shrunk too. Cold load on a throttled phone profile: welcome page 3.2 MB to about 0.6 MB.
- Not done, measured first: every page, starting with search, needs the whole catalog (about 190 kB gzipped with React), so
  splitting the data per page saves little. Item icons already load lazily. A parsed save folder takes about 200 bytes per
  item in localStorage (1,052 items: 215 kB), far from its ~5 MB limit, and the app already keeps working when storage is
  full, so IndexedDB can wait until someone hits it.

## 2. Getting saves in and out (done)

[docs/saves.md](docs/saves.md): finding the save folder on Windows and Steam Deck, copying it off a Deck, and putting
changed saves back. The app shows the same paths under "Where are my saves?". Consoles are out of scope.

## 3. Organizing other players' stashes (done)

The agent skill `.claude/skills/organize-stash` walks through it: get the saves and a backup, dry run, explain the
result in plain words (which mules, what goes where, starting kit dropped), write only after the player agrees, hand
back the new saves. Only tested on one real save folder so far; expect messier stashes to turn up new cases.

## 4. Keeping it organized (done)

- `--inbox 4,5`: only those shared stash pages are emptied, with the mules; other pages are working sets and stay.
- Uniques and set items go to their museum slots or to `DUP` mules; groups that grow get more mules (`-AA`, `-AB`...).
- `TRASH` mules: magic charms and jewels where every stat is a low roll (thresholds in `isJunk`,
  `src/lib/organize.js`), and extra copies of uniques and set items past `copiesNeeded` (one per class whose
  builds use the item, two for a ring; in single player a copy nobody wears only takes room), for the player to
  look through. Nothing is deleted. The app lists them under "To clean". The museum keeps the best-rolled copy.
- The dry run reports what the inbox pages bring: new museum items, new duplicates, likely junk.

## 5. Steam Deck plugin (released, not in the Decky store yet)

[decky/](decky/README.md): a Decky Loader plugin. The quick access panel opens the tracker in Steam's browser with
the Deck's own saves, and gets the item icons from the player's game files (the zip ships no game art). Its Organize
page sorts mules and inbox pages right on the Deck: refused while the game runs, the save folder is backed up first,
and the written files are read back (same bytes as `scripts/organize.mjs`). The server runs from "Open collection"
until the page is left (its Close button, B or the Steam button). Tested on a Deck; the zip is on GitHub Releases.
0.1.2 added deleting emptied characters, the backup list with restore, and the organize animation. The Decky store
is out: its rules turn away LLM-written plugins, so it stays on GitHub Releases ("Install Plugin from URL").

## Deployment

Moving from Netlify to Cloudflare Pages: `npm run deploy` builds locally (with the generated icons) and uploads `dist`
with wrangler, so icons stay out of git. Cloudflare Pages serves `index.html` for unknown paths when the build has no
`404.html`, which the router needs, so Netlify's `_redirects` is gone. Live at
https://d2r.diamonddoge.org (the Pages project d2r-collection-tracker, custom domain set in the Cloudflare
dashboard); the Netlify site is deleted. Done.

## 6. New finds and a leaner layout (2026-10-22)

- New finds page (`/new`, `src/lib/newItems.js`): the inbox pages' items with the organizing rules' verdict, read
  only so it works with the game running. D2R writes the shared stash only on save and exit (tested on the Deck: not
  on stash, waypoint, portal or act change), so finds show after each run's exit. No list in the Decky quick access
  panel: it would show the same thing one click sooner.
- Six tabs: New finds, Search, Collection (uniques, sets, runewords, runes as its pages), Characters, Organize,
  About. The Organize page folds its explanation after the first visit and the Deck's backup list.
- The museum keeps the best-rolled copy; duplicates past `copiesNeeded` go to TRASH; DUP mules mark each copy
  better or worse than the museum's; mules are dated below the other characters so D2R lists the mains first.
