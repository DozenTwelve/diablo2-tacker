import { useState } from "react";
import { labelOf } from "../lib/gameData";
import { groupByKey, itemsByPlace, ownerLabel, ownersOf, placeLabel, roleOf, totalCount } from "../lib/inventory";
import { museumLayout } from "../lib/organize";
import { t } from "../lib/i18n";
import { Link } from "../lib/router";
import { useStoredState } from "../lib/useStoredState";
import StashGrid, { colorOf } from "./StashGrid";
import Paperdoll from "./Paperdoll";
import StackTab from "./StackTab";
import PageTitle from "./PageTitle";
import BuildGear from "./BuildGear";

// Places drawn as grids, with their size in cells; the rest (equipped, belt...) are lists
const gridSize = (place) =>
  ({ stash: [10, 10], inventory: [10, 4], cube: [3, 4] })[place] ?? (/^shared\d+$/.test(place) ? [10, 10] : null);

// Equipment drawn as the in-game character screen; a mercenary only has these slots
const DOLLS = { equipped: undefined, merc: ["Head", "Torso", "RightArm", "LeftArm"] };

const MUSEUM = /^(UW|UA|UJ|SET)-/;
const groupOf = (o, roles) =>
  !o.cls ? "sharedStash" : roleOf(o, roles) === "main" ? "mainCharacters" : MUSEUM.test(o.name) ? "museumMules" : /^TRASH-/.test(o.name) ? "trashMules" : "otherMules";

// Akara's reset and Larzuk's socket per difficulty
const DIFFICULTIES = ["normal", "nightmare", "hell"];
const REWARD_COLOR = { available: "var(--color-gold)", used: "var(--color-text-muted)" };
function Rewards({ quests, lang }) {
  return (
    <div className="text-sm space-y-1">
      {["respec", "socket"].map((kind) => (
        <div key={kind} className="flex flex-wrap gap-x-4">
          <span className="gothic-text-muted w-28">{t(kind, lang)}</span>
          {quests[kind].map((state, i) => (
            <span key={i} style={{ color: REWARD_COLOR[state] ?? "#555" }}>
              {t(DIFFICULTIES[i], lang)} {t(state ?? "locked", lang)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
const GROUPS = ["mainCharacters", "museumMules", "otherMules", "trashMules", "sharedStash"];

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

// /characters: every character and stash as a card, grouped. In editing mode a click on a character
// switches it between main character and mule instead of opening it.
function CharacterList({ saveData, lang }) {
  const [roles, setRoles] = useStoredState("roles", {});
  const [editing, setEditing] = useState(false);
  const counts = new Map();
  for (const r of saveData.items) counts.set(r.owner, (counts.get(r.owner) ?? 0) + r.count);
  const owners = [...ownersOf(saveData)].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const toggle = (o) => setRoles({ ...roles, [o.name]: roleOf(o, roles) === "main" ? "mule" : "main" });
  const changed = owners.some((o) => o.cls && roles[o.name] && roles[o.name] !== (o.level > 1 ? "main" : "mule"));
  const mules = owners.filter((o) => o.cls && roleOf(o, roles) === "mule").map((o) => o.name);
  const sections = GROUPS.map((group) => {
    const list = owners.filter((o) => groupOf(o, roles) === group);
    if (!list.length) return null;
    return (
      <section key={group}>
        <div className="section-head">
          <h2>{t(group, lang)}</h2>
          <span className="section-count">{list.length}</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))" }}>
          {list.map((o) => {
            const open = (kind) => o.quests?.[kind].filter((s) => s === "available").length;
            const body = (
              <>
                <div className="gothic-text-gold truncate">{ownerLabel(o.name, lang)}</div>
                <div className="text-xs gothic-text-muted">
                  {o.cls && `${t(o.cls, lang)} Lv${o.level} · `}
                  {t("itemCount", lang, counts.get(o.name) ?? 0)}
                </div>
                {roleOf(o, roles) === "main" && (open("respec") > 0 || open("socket") > 0) && (
                  <div className="text-xs gothic-text-gold">
                    {open("respec") > 0 && `${t("respec", lang)} ×${open("respec")} `}
                    {open("socket") > 0 && `${t("socket", lang)} ×${open("socket")}`}
                  </div>
                )}
              </>
            );
            return editing && o.cls ? (
              <button key={o.name} className="tile text-left w-full" style={{ borderStyle: "dashed", borderColor: "var(--color-gold-dark)" }} onClick={() => toggle(o)}>
                {body}
              </button>
            ) : (
              <Link key={o.name} to={`/characters/${encodeURIComponent(o.name)}`} className="tile">
                {body}
              </Link>
            );
          })}
        </div>
      </section>
    );
  });
  return (
    <>
      <PageTitle label={t("characters", lang)}>
        <button className={`gothic-btn gothic-btn-small ${editing ? "" : "gothic-btn-secondary"}`} onClick={() => setEditing(!editing)}>
          {t(editing ? "done" : "editRoles", lang)}
        </button>
      </PageTitle>
      {editing && <p className="text-sm gothic-text-muted -mt-4 mb-6">{t("editRolesHint", lang)}</p>}
      <div className="space-y-10">{sections}</div>
      {changed && <p className="text-sm gothic-text-muted break-all mt-8">{t("mulesHint", lang, mules.join(","))}</p>}
    </>
  );
}

// /characters/<name>: storage drawn as in game, other places as lists
function CharacterPage({ saveData, name, lang }) {
  const [roles] = useStoredState("roles", {});
  const owner = ownersOf(saveData).find((o) => o.name === name);
  if (!owner) return <p className="gothic-text-muted">{t("noCharacter", lang)}</p>;
  const records = saveData.items.filter((r) => r.owner === name);
  const ghosts = MUSEUM.test(name) ? ghostsOf(name, saveData.items) : {};
  const places = itemsByPlace(saveData.items, name, lang);
  // Museum mules show their empty stash/inventory even when nothing is in it yet
  for (const place of Object.keys(ghosts)) if (!places.some((p) => p.place === place)) places.push({ place, lines: [] });
  const grids = places.filter((p) => gridSize(p.place));
  const lists = places.filter((p) => !gridSize(p.place) && !(p.place in DOLLS) && p.place !== "advanced");
  const stacked = records.filter((r) => r.place === "advanced");
  const dolls = Object.keys(DOLLS).filter((place) => records.some((r) => r.place === place));
  const noPositions = records.some((r) => (gridSize(r.place) && r.x == null) || (r.place in DOLLS && !r.slot));

  return (
    <div className="space-y-10">
      <div>
        <Link to="/characters" className="text-sm gothic-text-muted no-underline">
          ← {t("characters", lang)}
        </Link>
        <h1 className="page-title mt-2">{ownerLabel(name, lang)}</h1>
        <p className="gothic-text-muted mt-1 mb-3">
          {owner.cls && `${t(owner.cls, lang)} Lv${owner.level} · `}
          {t("itemCount", lang, totalCount(records))}
        </p>
        {owner.quests && <Rewards quests={owner.quests} lang={lang} />}
      </div>
      {noPositions && <p className="text-sm text-red-400">{t("reloadForGrid", lang)}</p>}
      {dolls.length > 0 && (
        <div className="flex flex-wrap gap-x-8 gap-y-10 items-start">
          {dolls.map((place) => (
            <div key={place} className="w-full" style={{ maxWidth: 8 * 44 }}>
              <div className="section-head">
                <h3>{placeLabel(place, lang)}</h3>
              </div>
              <Paperdoll records={records.filter((r) => r.place === place)} slots={DOLLS[place]} lang={lang} />
            </div>
          ))}
        </div>
      )}
      {owner.cls && roleOf(owner, roles) === "main" && <BuildGear owner={owner} saveData={saveData} lang={lang} />}
      <div className="flex flex-wrap gap-x-8 gap-y-10 items-start">
        {grids.map(({ place }) => {
          const [w, h] = gridSize(place);
          const inPlace = records.filter((r) => r.place === place && r.x != null);
          return (
            <div key={place} className="w-full" style={{ maxWidth: w * 44 }}>
              <div className="section-head">
                <h3>{placeLabel(place, lang)}</h3>
                <span className="section-count">{totalCount(inPlace)}</span>
              </div>
              <StashGrid width={w} height={h} records={inPlace} ghosts={ghosts[place]} lang={lang} />
            </div>
          );
        })}
      </div>
      {stacked.length > 0 && (
        <section>
          <div className="section-head">
            <h3>{placeLabel("advanced", lang)}</h3>
            <span className="section-count">{totalCount(stacked)}</span>
          </div>
          <StackTab byKey={groupByKey(stacked)} lang={lang} />
        </section>
      )}
      {lists.map(({ place, lines }) => (
        <section key={place}>
          <div className="section-head">
            <h3>{placeLabel(place, lang)}</h3>
            <span className="section-count">{totalCount(lines)}</span>
          </div>
          <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3 text-sm">
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
        </section>
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
