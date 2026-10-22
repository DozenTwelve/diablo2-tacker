import { useEffect, useState } from "react";
import { imageOf, labelOf } from "../lib/gameData";
import { groupByKey, itemsByPlace, ownerLabel, ownersOf, placeLabel, roleOf, totalCount } from "../lib/inventory";
import { modePrefix, museumLayout } from "../lib/organize";
import { copyScore } from "../lib/props";
import { nameOf, t } from "../lib/i18n";
import { Link, navigate } from "../lib/router";
import { useStoredState } from "../lib/useStoredState";
import StashGrid, { colorOf, STAT_COLOR } from "./StashGrid";
import Paperdoll from "./Paperdoll";
import StackTab from "./StackTab";
import PageTitle from "./PageTitle";
import BuildGear from "./BuildGear";
import { buildsOf, useBuild } from "../lib/builds";

// Places drawn as grids, with their size in cells, in this order (then shared stash pages); the rest are lists
const GRIDS = { inventory: [10, 4], stash: [10, 10], cube: [3, 4] };
const gridSize = (place) => GRIDS[place] ?? (/^shared\d+$/.test(place) ? [10, 10] : null);
const gridRank = (place) => Object.keys(GRIDS).indexOf(place) + 1 || 10 + Number(place.slice(6));

// Equipment drawn as the in-game character screen; a mercenary only has these slots
const DOLLS = { equipped: undefined, merc: ["Head", "Torso", "RightArm", "LeftArm"] };

const MUSEUM = /^H?[LC]?(UW|UA|UJ|SET)-/; // mule names of every mode (modePrefix)
const groupOf = (o, roles) =>
  !o.cls ? "sharedStash" : roleOf(o, roles) === "main" ? "mainCharacters" : MUSEUM.test(o.name) ? "museumMules" : /^H?[LC]?TRASH-/.test(o.name) ? "trashMules" : "otherMules";
const GROUPS = ["mainCharacters", "museumMules", "otherMules", "trashMules", "sharedStash"];

// Every character and stash in list order: by group, then by name
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const ordered = (saveData, roles) => GROUPS.flatMap((g) => ownersOf(saveData).filter((o) => groupOf(o, roles) === g).sort(byName));

// Akara's reset and Larzuk's socket still to collect: "阿卡拉重置 可用：惡夢、地獄", one line per kind
const DIFFICULTIES = ["normal", "nightmare", "hell"];
function openRewards(quests, lang) {
  if (!quests) return [];
  return ["respec", "socket"].flatMap((kind) => {
    const open = DIFFICULTIES.filter((_, i) => quests[kind][i] === "available").map((d) => t(d, lang));
    return open.length ? [`${t(kind, lang)} ${t("available", lang)}${t("colon", lang)}${open.join(t("listSeparator", lang))}`] : [];
  });
}

// Fixed slots of the museum layout per mule name prefix, one per game mode (see src/lib/organize.js)
const museums = new Map();
function museumSlots(prefix) {
  if (!museums.has(prefix)) museums.set(prefix, museumLayout(prefix).slots);
  return museums.get(prefix);
}
const PREFIXES = ["SoftCore", "HardCore"].flatMap((core) => ["Modern", "Legacy", "Classic"].map((v) => modePrefix(`${core}:${v}`)));

// Map record -> { score, museum }: a copy's roll score and the score of the copy in its museum slot (none: the
// slot is empty, or the item has no fixed slot)
function dupNotes(records, mode, allItems) {
  const slots = museumSlots(modePrefix(mode ?? ""));
  const notes = new Map();
  for (const r of records) {
    const score = copyScore(r);
    if (score == null) continue;
    const slot = slots.get(r.key);
    const there = slot && allItems.find((i) => i.key === r.key && i.owner === slot.mule);
    // An ethereal copy never takes a plain one's place (nor the reverse): no ▲/▼ across the two
    const same = there && there.ethereal === r.ethereal;
    notes.set(r, { score, museum: same ? copyScore(there) : null, otherKind: Boolean(there) && !same });
  }
  return notes;
}

// Each museum mule's filled and total fixed slots
function museumFill(items) {
  const owned = new Set(items.map((r) => `${r.owner}\n${r.key}`));
  const fill = new Map();
  for (const [key, s] of PREFIXES.flatMap((p) => [...museumSlots(p)])) {
    const f = fill.get(s.mule) ?? { owned: 0, total: 0 };
    f.total++;
    if (owned.has(`${s.mule}\n${key}`)) f.owned++;
    fill.set(s.mule, f);
  }
  return fill;
}

// Empty fixed slots of a museum mule, by place, with where else the item is owned
function ghostsOf(owner, mode, allItems) {
  const owned = new Set(allItems.filter((r) => r.owner === owner).map((r) => r.key));
  const ghosts = { stash: [], inventory: [] };
  for (const [key, s] of museumSlots(modePrefix(mode))) {
    if (s.mule !== owner || owned.has(key)) continue;
    ghosts[s.page.toLowerCase()].push({ key, ...s, elsewhere: allItems.filter((r) => r.key === key) });
  }
  return ghosts;
}

const FillRule = ({ owned, total, label }) => (
  <div className="progress-rule" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={owned}>
    <div style={{ width: `${(owned / total) * 100}%` }} />
  </div>
);

// /characters: every character and stash as a card, grouped. Main characters get bigger cards with their build;
// museum mules show how full they are; empty mules fold into one line. In editing mode a click on a character
// switches it between main character and mule instead of opening it.
function CharacterList({ saveData, lang }) {
  const [roles, setRoles] = useStoredState("roles", {});
  const [picked] = useStoredState("builds", {});
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const counts = new Map();
  for (const r of saveData.items) counts.set(r.owner, (counts.get(r.owner) ?? 0) + r.count);
  const fill = museumFill(saveData.items);
  const q = query.trim().toLowerCase();
  const owners = ordered(saveData, roles).filter((o) => !q || ownerLabel(o.name, lang).toLowerCase().includes(q));
  const toggle = (o) => setRoles({ ...roles, [o.name]: roleOf(o, roles) === "main" ? "mule" : "main" });
  const all = ownersOf(saveData);
  const changed = all.some((o) => o.cls && roles[o.name] && roles[o.name] !== (o.level > 1 ? "main" : "mule"));
  const mules = all.filter((o) => o.cls && roleOf(o, roles) === "mule").map((o) => o.name).sort();

  const card = (o, group) => {
    const count = counts.get(o.name) ?? 0;
    const f = fill.get(o.name);
    const build = group === "mainCharacters" && buildsOf(o.cls).find((b) => b.id === picked[o.name]);
    const body = (
      <>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`gothic-text-gold truncate ${group === "mainCharacters" ? "text-lg" : ""}`}>{ownerLabel(o.name, lang)}</span>
          <span className="text-xs gothic-text-muted shrink-0">{f ? `${f.owned} / ${f.total}` : t("itemCount", lang, count)}</span>
        </div>
        {group === "mainCharacters" && (
          <div className="text-sm gothic-text-muted">
            {t(o.cls, lang)} Lv{o.level}
            {build && <span style={{ color: "var(--color-gold-light)" }}> · {nameOf(build.name, lang)}</span>}
          </div>
        )}
        {group === "mainCharacters" &&
          openRewards(o.quests, lang).map((line) => (
            <div key={line} className="text-xs gothic-text-gold">
              {line}
            </div>
          ))}
        {f && (
          <div className="-mt-1">
            <FillRule {...f} label={ownerLabel(o.name, lang)} />
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
  };

  const sections = GROUPS.map((group) => {
    const list = owners.filter((o) => groupOf(o, roles) === group);
    if (!list.length) return null;
    // Empty mules matter only as free room: one folded line, unless filtering or choosing mules
    const fold = !q && !editing && group !== "mainCharacters" && group !== "sharedStash";
    const empty = fold ? list.filter((o) => !counts.get(o.name) && !fill.has(o.name)) : [];
    const shown = list.filter((o) => !empty.includes(o));
    return (
      <section key={group}>
        <div className="section-head">
          <h2>{t(group, lang)}</h2>
          <span className="section-count">{list.length}</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${group === "mainCharacters" ? 15 : 10}rem, 1fr))` }}>
          {shown.map((o) => card(o, group))}
        </div>
        {empty.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer gothic-text-muted">{t("emptyMules", lang, empty.length)}</summary>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {empty.map((o) => (
                <Link key={o.name} to={`/characters/${encodeURIComponent(o.name)}`} className="gothic-text-gold">
                  {o.name}
                </Link>
              ))}
            </p>
          </details>
        )}
      </section>
    );
  });
  return (
    <>
      <PageTitle label={t("characters", lang)}>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            className="gothic-input text-sm"
            style={{ width: "12rem", padding: "0.4rem 0.7rem" }}
            placeholder={t("filterCharacters", lang)}
            aria-label={t("filterCharacters", lang)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className={`gothic-btn gothic-btn-small ${editing ? "" : "gothic-btn-secondary"}`} onClick={() => setEditing(!editing)}>
            {t(editing ? "done" : "editRoles", lang)}
          </button>
        </div>
      </PageTitle>
      {editing && <p className="text-sm gothic-text-muted -mt-4 mb-6">{t("editRolesHint", lang)}</p>}
      <div className="space-y-10">{sections}</div>
      {changed && <p className="text-sm gothic-text-muted break-all mt-8">{t("mulesHint", lang, mules.join(","))}</p>}
    </>
  );
}

// One titled block of the character page
const Block = ({ title, count, width, children }) => (
  <section className="w-full" style={{ maxWidth: width }}>
    <div className="section-head">
      <h2>{title}</h2>
      {count != null && <span className="section-count">{count}</span>}
    </div>
    {children}
  </section>
);

// /characters/<name>: a header (where in the list, who, what is left to collect), then equipment and storage
// drawn as in game in one flowing row, then the stack tab and socketed items. ← and → go to the previous and
// next character in list order.
function CharacterPage({ saveData, name, lang }) {
  const [roles] = useStoredState("roles", {});
  const list = ordered(saveData, roles);
  const at = list.findIndex((o) => o.name === name);
  const owner = list[at];
  const [prev, next] = [list[at - 1], list[at + 1]];
  const picker = useBuild(owner ?? {});
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea, select") || document.querySelector("dialog[open]")) return;
      const to = { ArrowLeft: prev, ArrowRight: next }[e.key];
      if (to) navigate(`/characters/${encodeURIComponent(to.name)}`);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [prev, next]);
  if (!owner) return <p className="gothic-text-muted">{t("noCharacter", lang)}</p>;

  const records = saveData.items.filter((r) => r.owner === name);
  const museumMule = MUSEUM.test(name);
  const ghosts = museumMule ? ghostsOf(name, owner.mode, saveData.items) : {};
  const fill = museumMule ? museumFill(saveData.items).get(name) : null;
  // In a DUP mule each extra copy is scored against the copy in its museum slot: better ▲ or worse ▼
  const notes = /^H?[LC]?DUP-/.test(name) ? dupNotes(records, owner.mode, saveData.items) : undefined;
  const places = itemsByPlace(saveData.items, name, lang);
  // Museum mules show their empty stash/inventory even when nothing is in it yet
  for (const place of Object.keys(ghosts)) if (!places.some((p) => p.place === place)) places.push({ place, lines: [] });
  const grids = places.filter((p) => gridSize(p.place)).sort((a, b) => gridRank(a.place) - gridRank(b.place));
  const lists = places.filter((p) => !gridSize(p.place) && !(p.place in DOLLS) && p.place !== "advanced" && p.place !== "belt");
  const stacked = records.filter((r) => r.place === "advanced");
  // The belt as its 4 columns, a row per 4 slots
  const belt = records.filter((r) => r.place === "belt" && r.x != null).map((r) => ({ ...r, x: r.x % 4, y: Math.floor(r.x / 4) }));
  const main = owner.cls && roleOf(owner, roles) === "main";
  // A main character with builds for its class picks one on its equipment, even with nothing equipped
  const builds = main && buildsOf(owner.cls).length > 0;
  const dolls = Object.keys(DOLLS).filter((place) => (builds && place === "equipped") || records.some((r) => r.place === place));
  const noPositions = records.some((r) => (gridSize(r.place) && r.x == null) || (r.place in DOLLS && !r.slot));
  const step = (o, dir) =>
    o && (
      <Link to={`/characters/${encodeURIComponent(o.name)}`} className="inline-flex items-center min-h-11 px-2 gothic-text-muted" aria-label={t(dir, lang)}>
        {dir === "prevCharacter" ? `‹ ${ownerLabel(o.name, lang)}` : `${ownerLabel(o.name, lang)} ›`}
      </Link>
    );

  return (
    <div className="space-y-10">
      <header>
        <nav className="flex flex-wrap items-center justify-between gap-x-4 text-sm -ml-2 mb-2">
          <Link to="/characters" className="inline-flex items-center min-h-11 px-2 gothic-text-muted">
            ← {t("characters", lang)}
          </Link>
          <span className="flex">
            {step(prev, "prevCharacter")}
            {step(next, "nextCharacter")}
          </span>
        </nav>
        <PageTitle
          label={ownerLabel(name, lang)}
          owned={fill?.owned}
          total={fill?.total}
          sub={
            <>
              <p className="gothic-text-muted">
                {owner.cls && main && (
                  <>
                    <span className="gothic-text-gold">{t(owner.cls, lang)}</span> Lv{owner.level} ·{" "}
                  </>
                )}
                {t("itemCount", lang, totalCount(records))}
              </p>
              {main &&
                openRewards(owner.quests, lang).map((line) => (
                  <p key={line} className="gothic-text-gold">
                    {line}
                  </p>
                ))}
            </>
          }
        />
      </header>
      {noPositions && <p className="text-sm text-red-400">{t("reloadForGrid", lang)}</p>}
      {!records.length && !museumMule && <p className="gothic-text-muted">{t("emptyCharacter", lang)}</p>}
      <div className="flex flex-wrap gap-x-8 gap-y-10 items-start">
        {dolls.map((place) =>
          builds && place === "equipped" ? (
            <BuildGear key={place} owner={owner} picker={picker} records={records.filter((r) => r.place === place)} saveData={saveData} lang={lang} />
          ) : (
            <Block key={place} title={placeLabel(place, lang)} width={8 * 44}>
              <Paperdoll records={records.filter((r) => r.place === place)} slots={DOLLS[place]} lang={lang} />
            </Block>
          ),
        )}
        {grids.map(({ place }) => {
          const [w, h] = gridSize(place);
          const inPlace = records.filter((r) => r.place === place && r.x != null);
          return (
            <Block key={place} title={placeLabel(place, lang)} count={totalCount(inPlace)} width={w * 44}>
              <StashGrid width={w} height={h} records={inPlace} ghosts={ghosts[place]} notes={notes} lang={lang} />
            </Block>
          );
        })}
        {belt.length > 0 && (
          <Block title={placeLabel("belt", lang)} count={totalCount(belt)} width={4 * 44}>
            <StashGrid width={4} height={Math.max(...belt.map((r) => r.y)) + 1} records={belt} lang={lang} />
          </Block>
        )}
      </div>
      {stacked.length > 0 && (
        <Block title={placeLabel("advanced", lang)} count={totalCount(stacked)}>
          <StackTab byKey={groupByKey(stacked)} lang={lang} />
        </Block>
      )}
      {lists.map(({ place, lines }) => (
        <Block key={place} title={placeLabel(place, lang)} count={totalCount(lines)}>
          <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            {lines.map(({ record, stats, count }, i) => (
              <li key={i} className="flex gap-3">
                <img src={imageOf(record)} alt="" loading="lazy" className="w-8 h-8 object-contain shrink-0" />
                <div className="min-w-0">
                  <span style={{ color: colorOf(record) }}>{labelOf(record.key, lang)}</span>
                  {record.ethereal && <span className="gothic-text-muted"> · {t("ethereal", lang)}</span>}
                  {record.sockets > 0 && <span className="gothic-text-muted"> · {t("sockets", lang, record.sockets)}</span>}
                  {count > 1 && <span className="gothic-text-gold"> ×{count}</span>}
                  {stats.map((line, j) => (
                    <div key={j} style={{ color: STAT_COLOR }}>
                      {line}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Block>
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
