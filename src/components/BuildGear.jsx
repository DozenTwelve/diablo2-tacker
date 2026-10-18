import { useState } from "react";
import { catalog, iconOf, labelOf } from "../lib/gameData";
import { keyOfOption, SLOT_OF } from "../lib/builds";
import { nameOf, t } from "../lib/i18n";
import { groupByKey, ownerLabel, ownersOf, placeLabel } from "../lib/inventory";
import { Link } from "../lib/router";
import { colorOf } from "./StashGrid";
import { Modal } from "./Copies";
import Paperdoll from "./Paperdoll";

// Where an option counts as worn: a weapon or shield in either hand of weapon set I
const wornIn = (slot, location) =>
  slot === "weapon" || slot === "offhand" ? location === "RightArm" || location === "LeftArm" : SLOT_OF[location] === slot;

// Copies by where they are, in order: [{ owner, place, count }]
function placesOf(copies) {
  const places = new Map();
  for (const r of copies) {
    const id = `${r.owner}\n${r.place}`;
    places.set(id, { owner: r.owner, place: r.place, count: (places.get(id)?.count ?? 0) + r.count });
  }
  return [...places.values()];
}

// The builds of a character's class as buttons that wrap (see useBuild)
export function BuildPicker({ list, build, pick, lang }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={t("build", lang)}>
      <span className="gothic-text-muted w-28">{t("build", lang)}</span>
      {list.map((b) => (
        <button key={b.id} className={`chip ${b === build ? "active" : ""}`} aria-pressed={b === build} onClick={() => pick(b.id)}>
          {nameOf(b.name, lang)}
        </button>
      ))}
      {!build && <span className="text-xs gothic-text-muted">{t("pickBuild", lang)}</span>}
    </div>
  );
}

// A main character's equipment with its build: clicking a slot lists the build's options for it, each worn by
// this character, owned elsewhere (where) or missing; owned ones first, then in the guide's order.
export default function BuildGear({ owner, build, records, saveData, lang }) {
  const [opened, setOpened] = useState(null); // build slot whose options are shown

  // Items only move between characters of one mode (hardcore, Reign of the Warlock or not); saves read
  // before modes were recorded have none and match any
  const modes = new Map(ownersOf(saveData).map((o) => [o.name, o.mode]));
  const sameMode = (r) => !owner.mode || !modes.get(r.owner) || modes.get(r.owner) === owner.mode;
  const owned = groupByKey(saveData.items.filter(sameMode));
  const statusOf = (option, slot) => {
    const key = keyOfOption(option);
    if (!key) return { rank: 3 };
    // Spare copies first: one worn by another character is not free to take
    const copies = (owned.get(key) ?? []).toSorted((a, b) => (a.place === "equipped") - (b.place === "equipped"));
    const worn = (r) => (slot === "charm" ? r.place === "inventory" : r.place === "equipped" && (!r.slot || wornIn(slot, r.slot)));
    const inUse = copies.some((r) => r.owner === owner.name && worn(r));
    return { key, rank: inUse ? 0 : copies.length ? 1 : 2, copies };
  };
  const options = (build?.slots[opened] ?? []).map((option) => ({ option, ...statusOf(option, opened) }));
  options.sort((a, b) => a.rank - b.rank); // stable: the guide's order within a rank

  return (
    <div className="w-full" style={{ maxWidth: 8 * 44 }}>
      <div className="section-head">
        <h3>{placeLabel("equipped", lang)}</h3>
      </div>
      {build && <p className="text-xs gothic-text-muted mb-3">{t("clickSlot", lang)}</p>}
      <Paperdoll records={records} onSlot={build ? (slot) => build.slots[SLOT_OF[slot]] && setOpened(SLOT_OF[slot]) : undefined} lang={lang} />
      {build?.slots.charm && (
        <button className="gothic-btn gothic-btn-small gothic-btn-secondary mt-3" onClick={() => setOpened("charm")}>
          {t("slot_charm", lang)}
        </button>
      )}
      {build && (
        <p className="text-xs gothic-text-muted mt-3">
          {t("buildSource", lang)}{" "}
          <a href={build.url} target="_blank" rel="noreferrer" className="gothic-text-gold">
            {t("openGuide", lang)}
          </a>
        </p>
      )}
      <Modal open={Boolean(opened && build)} onClose={() => setOpened(null)} lang={lang} title={opened && `${t(`slot_${opened}`, lang)} · ${nameOf(build?.name, lang)}`}>
        <div className="grid sm:grid-cols-2 gap-3">
          {options.map(({ option, key, rank, copies }, i) => {
            const icon = key && iconOf(key, copies);
            return (
              <div key={i} className="flex gap-3 p-2" style={{ background: "rgba(0, 0, 0, 0.5)", border: rank === 2 ? "1px dashed #444" : "1px solid #333" }}>
                {key && (
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                    {icon && (
                      <img
                        src={icon}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                        style={rank === 2 ? { opacity: 0.3, filter: "grayscale(1)" } : undefined}
                      />
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <div style={{ color: rank === 2 ? "var(--color-text-muted)" : key ? colorOf({ key, quality: catalog.get(key).kind }) : undefined }}>
                    {key ? labelOf(key, lang) : nameOf(option.text, lang)}
                  </div>
                  {option.note && <div className="gothic-text-muted">{nameOf(option.note, lang)}</div>}
                  {rank === 0 && <div className="gothic-text-gold">{t("inUse", lang)}</div>}
                  {rank === 1 &&
                    placesOf(copies).map(({ owner: o, place, count }, j) => (
                      <Link key={j} to={`/characters/${encodeURIComponent(o)}`} onClick={() => setOpened(null)} className="block gothic-text-gold">
                        {ownerLabel(o, lang)} · {placeLabel(place, lang)}
                        {count > 1 && ` ×${count}`}
                      </Link>
                    ))}
                  {rank === 2 && <div className="gothic-text-muted">{t("missing", lang)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
