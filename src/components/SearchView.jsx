import { useMemo, useState } from "react";
import { catalog, labelOf, searchTextOf } from "../lib/gameData";
import { totalCount } from "../lib/inventory";
import { t } from "../lib/i18n";
import Locations from "./Locations";

const MAX_RESULTS = 100;

// Search everything owned plus every catalog entry, so missing items show up too.
export default function SearchView({ owned, lang }) {
  const [query, setQuery] = useState("");
  const keys = useMemo(() => {
    const collectible = [...catalog].filter(([, e]) => !e.legacy).map(([k]) => k);
    return [...new Set([...collectible, ...owned.keys()])];
  }, [owned]);

  const q = query.trim().toLowerCase();
  const matches = q ? keys.filter((k) => searchTextOf(k).includes(q)) : [];
  // Owned first, then by name
  matches.sort((a, b) => !owned.has(a) - !owned.has(b) || labelOf(a, lang).localeCompare(labelOf(b, lang)));

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
      {matches.slice(0, MAX_RESULTS).map((key) => {
        const records = owned.get(key);
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
