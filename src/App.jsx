import { useMemo } from "react";
import { uniques, sets, runewords, runes, uniqueKey, setItemKey, runewordKey, runeKey } from "./lib/gameData";
import { groupByKey } from "./lib/inventory";
import { LANGS, nameOf, t } from "./lib/i18n";
import { useStoredState } from "./lib/useStoredState";
import SaveLoader from "./components/SaveLoader";
import SearchView from "./components/SearchView";
import CollectionView from "./components/CollectionView";
import CharacterView from "./components/CharacterView";
import StackTab, { SECTIONS } from "./components/StackTab";
import ProgressBar from "./components/ProgressBar";
import { SET_GREEN } from "./components/StashGrid";
import { propLines, setBonusLines } from "./lib/props";
import { Link, usePath } from "./lib/router";

const TABS = ["search", "characters", "uniques", "sets", "runewords", "runes"];

// Collection tabs as groups of keys; uniques grouped by item category
function collectionGroups(tab, lang) {
  if (tab === "uniques") {
    const byCategory = new Map();
    for (const u of uniques.filter((u) => !u.legacy)) {
      const title = nameOf(u.category, lang);
      if (!byCategory.has(title)) byCategory.set(title, []);
      byCategory.get(title).push(uniqueKey(u));
    }
    return [...byCategory].map(([title, keys]) => ({ title, keys }));
  }
  if (tab === "sets") {
    // Set bonuses under each set: for more pieces worn (green), then the full set (gold)
    return sets.filter((s) => !s.legacy).map((s) => ({
      title: nameOf(s, lang),
      keys: s.items.map(setItemKey),
      notes: [
        ...setBonusLines(s.bonus, lang).map((line) => [SET_GREEN, line]),
        ["var(--color-gold)", `${t("fullSet", lang)}${t("colon", lang)}`],
        ...propLines(s.full, lang).map((line) => ["var(--color-gold)", line]),
      ],
    }));
  }
  return [{ title: t("runewords", lang), keys: runewords.map(runewordKey) }];
}

export default function App() {
  const [lang, setLang] = useStoredState("lang", "zh_tw");
  const [saveData, setSaveData] = useStoredState("saveData", null);
  const [first = "search", name] = usePath();
  const tab = TABS.includes(first) ? first : "search";
  const owned = useMemo(() => groupByKey(saveData?.items ?? []), [saveData]);

  return (
    <div className="gothic-container">
      <div className="gothic-header">
        <h1>{t("title", lang)}</h1>
        <p className="gothic-text-muted">Diablo II: Resurrected Collection Tracker</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        {TABS.map((tabName) => (
          <Link key={tabName} to={`/${tabName}`} className={`gothic-tab-btn no-underline ${tab === tabName ? "active" : ""}`}>
            {t(tabName, lang)}
          </Link>
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
        ) : tab === "runes" ? (
          // Runes as in the stackable tab, counted over every character and stash
          <div className="space-y-6">
            <ProgressBar label={t("runes", lang)} owned={runes.filter((r) => owned.has(runeKey(r))).length} total={runes.length} lang={lang} />
            <div className="gothic-card">
              <StackTab byKey={owned} sections={SECTIONS.filter(([name]) => name === "runes")} showWhere lang={lang} />
            </div>
          </div>
        ) : tab === "characters" ? (
          saveData && <CharacterView saveData={saveData} name={name} lang={lang} />
        ) : (
          <CollectionView key={tab} label={t(tab, lang)} groups={collectionGroups(tab, lang)} owned={owned} lang={lang} />
        )}
      </div>
    </div>
  );
}
