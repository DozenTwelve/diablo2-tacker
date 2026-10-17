import { useState } from "react";
import { catalog, imageOf, labelOf } from "../lib/gameData";
import { locationLines } from "../lib/inventory";
import { t } from "../lib/i18n";
import ProgressBar from "./ProgressBar";
import { Tooltip } from "./StashGrid";

// Icon for an entry: an owned copy's (runewords take their base's look), else the catalog one.
// A missing runeword has no base, so it shows its runes instead.
function Icon({ entryKey, records, lang }) {
  const names = catalog.get(entryKey).names;
  const style = records ? undefined : { opacity: 0.3, filter: "grayscale(1)" };
  if (records) return <img src={imageOf(records[0])} alt={labelOf(entryKey, lang)} loading="lazy" className="w-full h-full object-contain" />;
  if (names.code) return <img src={imageOf({ key: entryKey, code: names.code })} alt="" loading="lazy" className="w-full h-full object-contain" style={style} />;
  return (
    <div className="flex flex-wrap items-center justify-center w-full h-full" style={style}>
      {names.runes.map((code, i) => (
        <img key={i} src={imageOf({ key: `r:${code}`, code })} alt="" loading="lazy" style={{ width: 22, height: 22 }} />
      ))}
    </div>
  );
}

// One collection tab: groups of entry keys, each an icon tile, owned or dimmed.
// Hovering shows an owned copy's stats and where every copy is.
// groups: [{ title, keys: [key], notes?: [[color, line]] }] (notes: set bonuses)
export default function CollectionView({ label, groups, owned, lang }) {
  const [missingOnly, setMissingOnly] = useState(false);
  const [tip, setTip] = useState(null);
  const all = groups.flatMap((g) => g.keys);

  const show = (key, records) => (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const names = catalog.get(key).names;
    if (records) {
      const extra = locationLines(records, lang).map((l) => `${l.text}${l.count > 1 ? ` ×${l.count}` : ""}`);
      setTip({ item: records[0], extra, rect });
    } else {
      const runes = names.runes?.map((code) => labelOf(`r:${code}`, lang)).join(" + ");
      setTip({ item: { key, code: names.code }, ghost: true, extra: runes ? [runes] : [], rect });
    }
  };

  return (
    <div className="space-y-6">
      <ProgressBar label={label} owned={all.filter((k) => owned.has(k)).length} total={all.length} />
      <label className="gothic-checkbox">
        <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
        <span>{t("missingOnly", lang)}</span>
      </label>
      {groups.map(({ title, keys, notes = [] }) => {
        const shown = missingOnly ? keys.filter((k) => !owned.has(k)) : keys;
        if (!shown.length) return null;
        return (
          <div key={title} className="gothic-card">
            <h3 className="gothic-text-gold mb-4">
              {title}
              <span className="gothic-text-muted ml-4">
                ({keys.filter((k) => owned.has(k)).length} / {keys.length})
              </span>
            </h3>
            {notes.length > 0 && (
              <div className="text-sm leading-snug mb-4">
                {notes.map(([color, line], i) => (
                  <div key={i} style={{ color }}>
                    {line}
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))" }}>
              {shown.map((key) => {
                const records = owned.get(key);
                return (
                  <div
                    key={key}
                    onMouseEnter={show(key, records)}
                    onMouseLeave={() => setTip(null)}
                    onClick={show(key, records)}
                    className="flex flex-col items-center gap-1 p-1"
                    style={{ background: "rgba(0, 0, 0, 0.45)", border: "1px solid var(--color-border-metal)" }}
                  >
                    <div className="w-full" style={{ height: 88 }}>
                      <Icon entryKey={key} records={records} lang={lang} />
                    </div>
                    <div className={`text-xs text-center leading-tight ${records ? "gothic-text-gold" : "gothic-text-muted"}`}>
                      {labelOf(key, lang)}
                      {records?.length > 1 && ` ×${records.length}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {tip && <Tooltip tip={tip} lang={lang} />}
    </div>
  );
}
