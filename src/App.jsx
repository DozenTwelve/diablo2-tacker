import { useMemo, useState } from "react";
import { uniques, sets, runewords, runes, uniqueKey, setItemKey, runewordKey, runeKey } from "./lib/gameData";
import { groupByKey } from "./lib/inventory";
import { LANGS, nameOf, t } from "./lib/i18n";
import { useStoredState } from "./lib/useStoredState";
import SaveLoader from "./components/SaveLoader";
import SearchView from "./components/SearchView";
import CollectionView from "./components/CollectionView";
import CharacterView from "./components/CharacterView";

const TABS = ["search", "characters", "uniques", "sets", "runewords", "runes"];

// Collection tabs as groups of keys; uniques grouped by item category
function collectionGroups(tab, lang) {
  if (tab === "uniques") {
    const byCategory = new Map();
    for (const u of uniques.filter((u) => !u.legacy)) {
      const title = lang === "zh" ? u.category : u.category_tw;
      if (!byCategory.has(title)) byCategory.set(title, []);
      byCategory.get(title).push(uniqueKey(u));
    }
    return [...byCategory].map(([title, keys]) => ({ title, keys }));
  }
  if (tab === "sets") return sets.map((s) => ({ title: nameOf(s, lang), keys: s.items.map(setItemKey) }));
  if (tab === "runewords") return [{ title: t("runewords", lang), keys: runewords.map(runewordKey) }];
  return [{ title: t("runes", lang), keys: runes.map(runeKey) }];
}

export default function App() {
  const [lang, setLang] = useStoredState("lang", "zh_tw");
  const [saveData, setSaveData] = useStoredState("saveData", null);
  const [tab, setTab] = useState("search");
  const owned = useMemo(() => groupByKey(saveData?.items ?? []), [saveData]);

  return (
    <div className="gothic-container">
      <div className="gothic-header">
        <h1>{t("title", lang)}</h1>
        <p className="gothic-text-muted">Diablo II: Resurrected Collection Tracker</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        {TABS.map((name) => (
          <button key={name} className={`gothic-tab-btn ${tab === name ? "active" : ""}`} onClick={() => setTab(name)}>
            {t(name, lang)}
          </button>
        ))}
        <div className="flex gap-2 ml-auto">
          {Object.entries(LANGS).map(([code, label]) => (
            <button key={code} className={`gothic-tab-btn ${lang === code ? "active" : ""}`} onClick={() => setLang(code)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <SaveLoader saveData={saveData} onLoad={setSaveData} lang={lang} />
        {tab === "search" ? (
          <SearchView owned={owned} lang={lang} />
        ) : tab === "characters" ? (
          saveData && <CharacterView saveData={saveData} lang={lang} />
        ) : (
          <CollectionView key={tab} label={t(tab, lang)} groups={collectionGroups(tab, lang)} owned={owned} lang={lang} />
        )}
      </div>
    </div>
  );
}
