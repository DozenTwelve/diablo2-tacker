import { useMemo, useState } from "react";
import { catalog, labelOf, searchTextOf } from "../lib/gameData";
import { statLines, totalCount } from "../lib/inventory";
import { t } from "../lib/i18n";
import Locations from "./Locations";

const MAX_RESULTS = 100;

// Search everything owned plus every catalog entry, so missing items show up too.
// A query matching only stats ("+1 to Passive") lists just the copies with those stats.
export default function SearchView({ owned, lang }) {
  const [query, setQuery] = useState("");
  const keys = useMemo(() => {
    const collectible = [...catalog].filter(([, e]) => !e.legacy).map(([k]) => k);
    return [...new Set([...collectible, ...owned.keys()])];
  }, [owned]);

  const statText = useMemo(() => {
    const map = new Map();
    for (const records of owned.values()) for (const r of records) map.set(r, statLines(r, lang).join("\n").toLowerCase());
    return map;
  }, [owned, lang]);

  const q = query.trim().toLowerCase();
  const matches = !q
    ? []
    : keys
        .map((key) => {
          const records = owned.get(key);
          if (searchTextOf(key).includes(q)) return { key, records };
          const hits = records?.filter((r) => statText.get(r).includes(q));
          return hits?.length ? { key, records: hits } : null;
        })
        .filter(Boolean);
  // Owned first, then by name
  matches.sort((a, b) => !a.records - !b.records || labelOf(a.key, lang).localeCompare(labelOf(b.key, lang)));

  return (
    <div className="space-y-4">
      <input
        className="gothic-input"
        placeholder={t("searchPlaceholder", lang)}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {q && matches.length === 0 && <p className="gothic-text-muted">{t("noResults", lang)}</p>}
      {matches.length > MAX_RESULTS && <p className="gothic-text-muted">{t("tooMany", lang, MAX_RESULTS)}</p>}
      {matches.slice(0, MAX_RESULTS).map(({ key, records }) => {
        return (
          <div key={key} className="gothic-card">
            <div className="flex justify-between gap-4">
              <span className={records ? "gothic-text-gold" : "gothic-text-muted"}>{labelOf(key, lang)}</span>
              <span className={records ? "gothic-text-gold" : "gothic-text-muted"}>
                {records ? `×${totalCount(records)}` : t("missing", lang)}
              </span>
            </div>
            {records && <Locations records={records} lang={lang} />}
          </div>
        );
      })}
    </div>
  );
}
