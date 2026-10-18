import { catalog, labelOf } from "../lib/gameData";
import { buildsOf, keyOfOption, SLOTS } from "../lib/builds";
import { nameOf, t } from "../lib/i18n";
import { groupByKey, ownerLabel, ownersOf, placeLabel } from "../lib/inventory";
import { Link } from "../lib/router";
import { useStoredState } from "../lib/useStoredState";
import { colorOf } from "./StashGrid";

// Equipment slots (body_location) each kind of option is worn in; charms work from the inventory
const WORN = {
  weapon: ["RightArm", "LeftArm"],
  offhand: ["RightArm", "LeftArm"],
  swap: ["RightHand", "LeftHand"],
  helm: ["Head"],
  armor: ["Torso"],
  gloves: ["Gloves"],
  belt: ["Belt"],
  boots: ["Feet"],
  amulet: ["Neck"],
  ring: ["RightRing", "LeftRing"],
};

// The recommended gear of the build picked for a character (src/lib/builds.js), slot by slot. Each option is
// in use by this character, owned elsewhere (where) or missing; owned ones first, then in the guide's order.
export default function BuildGear({ owner, saveData, lang }) {
  const [picked, setPicked] = useStoredState("builds", {}); // character -> build id
  const list = buildsOf(owner.cls);
  if (!list.length) return null;
  const build = list.find((b) => b.id === picked[owner.name]);
  const pick = (id) => setPicked({ ...picked, [owner.name]: id === build?.id ? undefined : id });

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
    const worn = (r) => (slot === "charm" ? r.place === "inventory" : r.place === "equipped" && (!r.slot || WORN[slot].includes(r.slot)));
    const inUse = copies.some((r) => r.owner === owner.name && worn(r));
    return { key, rank: inUse ? 0 : copies.length ? 1 : 2, copies };
  };

  return (
    <section>
      <div className="section-head">
        <h2>{t("build", lang)}</h2>
      </div>
      <div className="segmented mb-3" role="group">
        {list.map((b) => (
          <button key={b.id} className={b === build ? "active" : ""} aria-pressed={b === build} onClick={() => pick(b.id)}>
            {nameOf(b.name, lang)}
          </button>
        ))}
      </div>
      {!build ? (
        <p className="text-sm gothic-text-muted">{t("pickBuild", lang)}</p>
      ) : (
        <>
          <p className="text-sm gothic-text-muted mb-6">
            {t("buildSource", lang)}{" "}
            <a href={build.url} target="_blank" rel="noreferrer" className="gothic-text-gold">
              {t("openGuide", lang)}
            </a>
          </p>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6 text-sm">
            {SLOTS.filter((slot) => build.slots[slot]).map((slot) => {
              const options = build.slots[slot].map((option) => ({ option, ...statusOf(option, slot) }));
              options.sort((a, b) => a.rank - b.rank); // stable: the guide's order within a rank
              return (
                <div key={slot}>
                  <h3 className="gothic-text-muted mb-1">{t(`slot_${slot}`, lang)}</h3>
                  <ul className="space-y-1">
                    {options.map(({ option, key, rank, copies }, i) => (
                      <li key={i} className="flex gap-3 justify-between" style={{ opacity: rank === 2 ? 0.55 : 1 }}>
                        <span className="min-w-0">
                          {key ? (
                            <span style={{ color: colorOf({ key, quality: catalog.get(key).kind }) }}>{labelOf(key, lang)}</span>
                          ) : (
                            <span>{nameOf(option.text, lang)}</span>
                          )}
                          {option.note && <span className="gothic-text-muted"> · {nameOf(option.note, lang)}</span>}
                        </span>
                        <span className="shrink-0 text-right">
                          {rank === 0 && <span className="gothic-text-gold">{t("inUse", lang)}</span>}
                          {rank === 1 && (
                            <Link to={`/characters/${encodeURIComponent(copies[0].owner)}`} className="gothic-text-muted">
                              {ownerLabel(copies[0].owner, lang)} · {placeLabel(copies[0].place, lang)}
                              {copies.length > 1 && ` +${copies.length - 1}`}
                            </Link>
                          )}
                          {rank === 2 && <span className="gothic-text-muted">{t("missing", lang)}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
