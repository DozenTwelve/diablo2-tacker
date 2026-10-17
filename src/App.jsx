import { useEffect, useMemo } from "react";
import { uniques, sets, runewords, runes, uniqueKey, setItemKey, runewordKey, runeKey } from "./lib/gameData";
import { groupByKey } from "./lib/inventory";
import { LANGS, nameOf, t } from "./lib/i18n";
import { useStoredState } from "./lib/useStoredState";
import { deckSaveFiles, onDeck } from "./lib/deck";
import { parseSaveFiles } from "./lib/parseSaves";
import SaveLoader from "./components/SaveLoader";
import SearchView from "./components/SearchView";
import CollectionView from "./components/CollectionView";
import CharacterView from "./components/CharacterView";
import ErrorBoundary from "./components/ErrorBoundary";
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
  if (tab === "runes") return [{ title: t("runes", lang), keys: runes.map(runeKey) }];
  return [{ title: t("runewords", lang), keys: runewords.map(runewordKey) }];
}

export default function App() {
  const [lang, setLang] = useStoredState("lang", "zh_tw");
  const [saveData, setSaveData, notStored] = useStoredState("saveData", null);
  const [first = "search", name] = usePath();
  const tab = TABS.includes(first) ? first : "search";
  const owned = useMemo(() => groupByKey(saveData?.items ?? []), [saveData]);
  // On the Deck, read the saves fresh every time the page opens
  useEffect(() => {
    if (onDeck) deckSaveFiles().then(parseSaveFiles).then(setSaveData);
  }, [setSaveData]);
  // For screen readers and the right Chinese glyphs
  useEffect(() => {
    document.documentElement.lang = { zh: "zh-Hans", zh_tw: "zh-Hant", en: "en", ko: "ko" }[lang] ?? "en";
  }, [lang]);

  return (
    <div className="gothic-container">
      <header className="app-bar">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
          <Link to="/search" className="app-title no-underline">
            {t("title", lang)}
          </Link>
          <nav className="flex gap-5 overflow-x-auto order-last w-full lg:order-none lg:w-auto">
            {TABS.map((tabName) => (
              <Link
                key={tabName}
                to={`/${tabName}`}
                className={`nav-link ${tab === tabName ? "active" : ""}`}
                aria-current={tab === tabName ? "page" : undefined}
              >
                {t(tabName, lang)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            {saveData && <SaveLoader saveData={saveData} onLoad={setSaveData} notStored={notStored} lang={lang} compact />}
            <div className="segmented" role="group" aria-label="Language">
              {Object.entries(LANGS).map(([code, label]) => (
                <button key={code} className={lang === code ? "active" : ""} aria-pressed={lang === code} onClick={() => setLang(code)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main>
        {!saveData && <SaveLoader saveData={saveData} onLoad={setSaveData} notStored={notStored} lang={lang} />}
        <ErrorBoundary key={`${tab}/${name}`} lang={lang} onReset={() => setSaveData(null)}>
          {tab === "search" ? (
            <SearchView owned={owned} lang={lang} />
          ) : tab === "characters" ? (
            saveData && <CharacterView saveData={saveData} name={name} lang={lang} />
          ) : (
            <CollectionView key={tab} label={t(tab, lang)} groups={collectionGroups(tab, lang)} owned={owned} lang={lang} />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
