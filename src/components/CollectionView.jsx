import { useState } from "react";
import { catalog, iconOf, imageOf, labelOf } from "../lib/gameData";
import { locationLines, ownerLabel, totalCount } from "../lib/inventory";
import { t } from "../lib/i18n";
import PageTitle from "./PageTitle";
import { Tooltip, tipHandlers, useTip } from "./StashGrid";
import Copies from "./Copies";

// "LastOne ×2、JavaZon、Zanna ×2": owners of several copies on one line
function ownerSummary(records, lang) {
  const counts = new Map();
  for (const r of records) counts.set(r.owner, (counts.get(r.owner) ?? 0) + r.count);
  return [...counts].map(([owner, n]) => `${ownerLabel(owner, lang)}${n > 1 ? ` ×${n}` : ""}`).join(t("listSeparator", lang));
}

// Icon for an entry: an owned copy's (runewords take their base's look), else the catalog one.
// A missing runeword has no base, so it shows its runes instead.
function Icon({ entryKey, records, lang }) {
  const names = catalog.get(entryKey).names;
  const style = records ? undefined : { opacity: 0.3, filter: "grayscale(1)" };
  const icon = iconOf(entryKey, records);
  if (icon) return <img src={icon} alt={records ? labelOf(entryKey, lang) : ""} loading="lazy" className="w-full h-full object-contain" style={style} />;
  return (
    <span className="flex flex-wrap items-center justify-center w-full h-full" style={style}>
      {names.runes.map((code, i) => (
        <img key={i} src={imageOf({ key: `r:${code}`, code })} alt="" loading="lazy" style={{ width: 22, height: 22 }} />
      ))}
    </span>
  );
}

// One collection tab: groups of entry keys, each an icon tile, owned or dimmed.
// Hovering shows an owned copy's stats and where it is; with several copies, the catalog ranges and their
// owners in one line, and clicking lists every copy (Copies).
// groups: [{ title, keys: [key], notes?: [[color, line]] }] (notes: set bonuses)
export default function CollectionView({ label, groups, owned, lang }) {
  const [missingOnly, setMissingOnly] = useState(false);
  const [tip, setTip] = useTip();
  const [opened, setOpened] = useState(null); // key whose copies are listed
  const all = groups.flatMap((g) => g.keys);

  const show = (key, records) => (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const names = catalog.get(key).names;
    if (records?.length > 1) {
      const extra = [ownerSummary(records, lang), t("clickForCopies", lang, records.length)];
      setTip({ item: { key, code: names.code, quality: records[0].quality }, summary: true, extra, rect });
    } else if (records) {
      const extra = locationLines(records, lang).map((l) => `${l.text}${l.count > 1 ? ` ×${l.count}` : ""}`);
      setTip({ item: records[0], extra, rect });
    } else {
      const runes = names.runes?.map((code) => labelOf(`r:${code}`, lang)).join(" + ");
      setTip({ item: { key, code: names.code }, ghost: true, extra: runes ? [runes] : [], rect });
    }
  };

  const ownedIn = (keys) => keys.filter((k) => owned.has(k)).length;
  return (
    <>
      <PageTitle label={label} owned={ownedIn(all)} total={all.length}>
        <label className="gothic-checkbox text-sm">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          <span>{t("missingOnly", lang)}</span>
        </label>
      </PageTitle>
      <div className="lg:grid lg:gap-10 items-start" style={{ gridTemplateColumns: groups.length > 1 ? "13rem minmax(0, 1fr)" : "minmax(0, 1fr)" }}>
        {groups.length > 1 && (
          <nav className="toc hidden lg:block sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            {groups.map(({ title, keys }, i) =>
              missingOnly && ownedIn(keys) === keys.length ? null : (
                <a key={title} href={`#group-${i}`} className={ownedIn(keys) === keys.length ? "complete" : ""}>
                  <span className="truncate">{title}</span>
                  <span className="gothic-text-muted shrink-0">
                    {ownedIn(keys)}/{keys.length}
                  </span>
                </a>
              ),
            )}
          </nav>
        )}
        <div className="space-y-10">
          {groups.map(({ title, keys, notes = [] }, i) => {
            const shown = missingOnly ? keys.filter((k) => !owned.has(k)) : keys;
            if (!shown.length) return null;
            return (
              <section key={title} id={`group-${i}`}>
                {groups.length > 1 && (
                  <div className="section-head">
                    <h2>{title}</h2>
                    <span className="section-count">
                      {ownedIn(keys)} / {keys.length}
                    </span>
                  </div>
                )}
                {notes.length > 0 && (
                  <div className="text-sm leading-snug mb-4 max-w-prose">
                    {notes.map(([color, line], j) => (
                      <div key={j} style={{ color }}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))" }}>
                  {shown.map((key) => {
                    const records = owned.get(key);
                    return (
                      <button
                        type="button"
                        key={key}
                        {...tipHandlers(show(key, records), setTip)}
                        onClick={records ? () => (setTip(null), setOpened(key)) : show(key, records)}
                        className={`flex flex-col items-center gap-1 p-1 ${records ? "cursor-pointer" : "cursor-default"}`}
                        style={{ background: "rgba(0, 0, 0, 0.45)", border: `1px solid ${records ? "var(--color-border-metal)" : "var(--color-border-steel)"}` }}
                      >
                        <span className="block w-full" style={{ height: 88 }}>
                          <Icon entryKey={key} records={records} lang={lang} />
                        </span>
                        <span className={`block text-xs text-center leading-tight ${records ? "gothic-text-gold" : "gothic-text-muted"}`}>
                          {labelOf(key, lang)}
                          {totalCount(records) > 1 && ` ×${totalCount(records)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {tip && <Tooltip tip={tip} lang={lang} />}
      <Copies entryKey={opened} records={opened ? owned.get(opened) : null} onClose={() => setOpened(null)} lang={lang} />
    </>
  );
}
