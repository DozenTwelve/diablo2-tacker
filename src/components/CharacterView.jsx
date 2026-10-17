import { useState } from "react";
import { labelOf } from "../lib/gameData";
import { itemsByPlace, ownerLabel, ownersOf, placeLabel, totalCount } from "../lib/inventory";
import { t } from "../lib/i18n";

// In-game item name colors
const QUALITY_COLORS = {
  Unique: "#c7b377",
  Set: "#00c400",
  Rare: "#ffff64",
  Magic: "#6969ff",
  Craft: "#ffa500",
};
const colorOf = (r) => (r.key.startsWith("w:") ? QUALITY_COLORS.Unique : QUALITY_COLORS[r.quality]);

// Pick a character (or shared stash) and see everything it holds, by place.
export default function CharacterView({ saveData, lang }) {
  const owners = ownersOf(saveData);
  const [selected, setSelected] = useState(owners[0]?.name);
  const counts = new Map();
  for (const r of saveData.items) counts.set(r.owner, (counts.get(r.owner) ?? 0) + r.count);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex md:flex-col flex-wrap gap-2 md:w-56 shrink-0">
        {owners.map((o) => (
          <button
            key={o.name}
            className={`gothic-tab-btn text-left ${selected === o.name ? "active" : ""}`}
            onClick={() => setSelected(o.name)}
          >
            <div>{ownerLabel(o.name, lang)}</div>
            <div className="text-xs opacity-75">
              {o.cls && `${t(o.cls, lang)} Lv${o.level} · `}
              {t("itemCount", lang, counts.get(o.name) ?? 0)}
            </div>
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 min-w-0">
        {!selected && <p className="gothic-text-muted">{t("pickCharacter", lang)}</p>}
        {selected &&
          itemsByPlace(saveData.items, selected, lang).map(({ place, lines }) => (
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
    </div>
  );
}
