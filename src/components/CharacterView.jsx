import { labelOf } from "../lib/gameData";
import { itemsByPlace, ownerLabel, ownersOf, placeLabel, totalCount } from "../lib/inventory";
import { museumLayout } from "../lib/organize";
import { t } from "../lib/i18n";
import { Link } from "../lib/router";
import StashGrid, { colorOf } from "./StashGrid";

// Places drawn as grids, with their size in cells; the rest (equipped, belt...) are lists
const gridSize = (place) =>
  ({ stash: [10, 10], inventory: [10, 4], cube: [3, 4] })[place] ?? (/^shared\d+$/.test(place) ? [10, 10] : null);

const MUSEUM = /^(UW|UA|UJ|SET)-/;
const groupOf = (o) => (!o.cls ? "sharedStash" : o.level > 1 ? "mainCharacters" : MUSEUM.test(o.name) ? "museumMules" : "otherMules");
const GROUPS = ["mainCharacters", "museumMules", "otherMules", "sharedStash"];

// Empty fixed slots of a museum mule (see src/lib/organize.js), by place, with where else the item is owned
let museum;
function ghostsOf(owner, allItems) {
  museum ??= museumLayout();
  const owned = new Set(allItems.filter((r) => r.owner === owner).map((r) => r.key));
  const ghosts = { stash: [], inventory: [] };
  for (const [key, s] of museum.slots) {
    if (s.mule !== owner || owned.has(key)) continue;
    ghosts[s.page.toLowerCase()].push({ key, ...s, elsewhere: allItems.filter((r) => r.key === key) });
  }
  return ghosts;
}

// /characters: every character and stash as a card, grouped
function CharacterList({ saveData, lang }) {
  const counts = new Map();
  for (const r of saveData.items) counts.set(r.owner, (counts.get(r.owner) ?? 0) + r.count);
  const owners = ownersOf(saveData).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return GROUPS.map((group) => {
    const list = owners.filter((o) => groupOf(o) === group);
    if (!list.length) return null;
    return (
      <section key={group}>
        <h3 className="gothic-text-gold mb-3">
          {t(group, lang)}
          <span className="gothic-text-muted ml-4">({list.length})</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {list.map((o) => (
            <Link key={o.name} to={`/characters/${encodeURIComponent(o.name)}`} className="gothic-card block p-3 no-underline">
              <div className="gothic-text-gold truncate">{ownerLabel(o.name, lang)}</div>
              <div className="text-xs gothic-text-muted">
                {o.cls && `${t(o.cls, lang)} Lv${o.level} · `}
                {t("itemCount", lang, counts.get(o.name) ?? 0)}
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  });
}

// /characters/<name>: storage drawn as in game, other places as lists
function CharacterPage({ saveData, name, lang }) {
  const owner = ownersOf(saveData).find((o) => o.name === name);
  if (!owner) return <p className="gothic-text-muted">{t("noCharacter", lang)}</p>;
  const records = saveData.items.filter((r) => r.owner === name);
  const ghosts = MUSEUM.test(name) ? ghostsOf(name, saveData.items) : {};
  const places = itemsByPlace(saveData.items, name, lang);
  // Museum mules show their empty stash/inventory even when nothing is in it yet
  for (const place of Object.keys(ghosts)) if (!places.some((p) => p.place === place)) places.push({ place, lines: [] });
  const grids = places.filter((p) => gridSize(p.place));
  const lists = places.filter((p) => !gridSize(p.place));
  const noPositions = records.some((r) => gridSize(r.place) && r.x == null);

  return (
    <div className="space-y-4">
      <div>
        <Link to="/characters" className="text-sm gothic-text-muted">
          ← {t("characters", lang)}
        </Link>
        <h2 className="gothic-text-gold text-xl mt-1">{ownerLabel(name, lang)}</h2>
        <p className="text-sm gothic-text-muted">
          {owner.cls && `${t(owner.cls, lang)} Lv${owner.level} · `}
          {t("itemCount", lang, totalCount(records))}
        </p>
      </div>
      {noPositions && <p className="text-sm text-red-400">{t("reloadForGrid", lang)}</p>}
      <div className="flex flex-wrap gap-6 items-start">
        {grids.map(({ place }) => {
          const [w, h] = gridSize(place);
          const inPlace = records.filter((r) => r.place === place && r.x != null);
          return (
            <div key={place} className="w-full" style={{ maxWidth: w * 44 }}>
              <h3 className="gothic-text-gold mb-2 text-sm">
                {placeLabel(place, lang)}
                <span className="gothic-text-muted ml-3">({totalCount(inPlace)})</span>
              </h3>
              <StashGrid width={w} height={h} records={inPlace} ghosts={ghosts[place]} lang={lang} />
            </div>
          );
        })}
      </div>
      {lists.map(({ place, lines }) => (
        <div key={place} className="gothic-card">
          <h3 className="gothic-text-gold mb-3">
            {placeLabel(place, lang)}
            <span className="gothic-text-muted ml-4">({totalCount(lines)})</span>
          </h3>
          <ul className="grid md:grid-cols-2 gap-3 text-sm">
            {lines.map(({ record, stats, count }, i) => (
              <li key={i}>
                <span style={{ color: colorOf(record) }}>{labelOf(record.key, lang)}</span>
                {record.ethereal && <span className="gothic-text-muted"> · {t("ethereal", lang)}</span>}
                {record.sockets > 0 && <span className="gothic-text-muted"> · {t("sockets", lang, record.sockets)}</span>}
                {count > 1 && <span className="gothic-text-gold"> ×{count}</span>}
                {stats.map((line, j) => (
                  <div key={j} className="pl-4" style={{ color: "var(--color-accent-blue)" }}>
                    {line}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function CharacterView({ saveData, name, lang }) {
  return name ? (
    <CharacterPage saveData={saveData} name={name} lang={lang} />
  ) : (
    <CharacterList saveData={saveData} lang={lang} />
  );
}
