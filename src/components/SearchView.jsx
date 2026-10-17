import { useMemo, useState } from "react";
import { catalog, imageOf, labelOf, searchTextOf } from "../lib/gameData";
import { statLines, totalCount } from "../lib/inventory";
import { t } from "../lib/i18n";
import Locations from "./Locations";
import PageTitle from "./PageTitle";

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

  // Icon of an owned copy, else the catalog's (a missing runeword has none)
  const iconOf = (key, records) => {
    if (records) return imageOf(records[0]);
    const code = catalog.get(key)?.names.code ?? (key.startsWith("b:") || key.startsWith("r:") ? key.split(":")[1] : null);
    return code && imageOf({ key, code });
  };

  return (
    <>
      <PageTitle label={t("search", lang)} />
      <input
        className="gothic-input max-w-2xl"
        style={{ fontSize: "1.1rem" }}
        placeholder={t("searchPlaceholder", lang)}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="mt-6 max-w-3xl">
        {q && matches.length === 0 && <p className="gothic-text-muted">{t("noResults", lang)}</p>}
        {matches.length > MAX_RESULTS && <p className="gothic-text-muted mb-3">{t("tooMany", lang, MAX_RESULTS)}</p>}
        <div className="rows">
          {matches.slice(0, MAX_RESULTS).map(({ key, records }) => {
            const icon = iconOf(key, records);
            return (
              <div key={key} className="flex gap-4 py-3">
                <span className="w-10 h-10 shrink-0">
                  {icon && (
                    <img
                      src={icon}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-contain"
                      style={records ? undefined : { opacity: 0.3, filter: "grayscale(1)" }}
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-4">
                    <span className={records ? "gothic-text-gold" : "gothic-text-muted"}>{labelOf(key, lang)}</span>
                    <span className={records ? "gothic-text-gold" : "gothic-text-muted"}>
                      {records ? `×${totalCount(records)}` : t("missing", lang)}
                    </span>
                  </div>
                  {records && <Locations records={records} lang={lang} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
