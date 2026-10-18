import { useCallback, useEffect, useMemo, useState } from "react";
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
import OrganizeView from "./components/OrganizeView";
import Welcome from "./components/Welcome";
import Faq from "./components/Faq";
import { REPO } from "./lib/links";
import ErrorBoundary from "./components/ErrorBoundary";
import { SET_GREEN } from "./components/StashGrid";
import { propLines, setBonusLines } from "./lib/props";
import { Link, usePath } from "./lib/router";

const TABS = ["search", "characters", "uniques", "sets", "runewords", "runes", "organize"];

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
  const [first, name] = usePath();
  // The front page is the welcome page until saves are loaded
  const tab = !first ? (saveData ? "search" : "welcome") : [...TABS, "faq"].includes(first) ? first : "search";
  const [rawFiles, setRawFiles] = useState(null); // the files as last picked, for organizing; memory only
  const [offered, setOffered] = useStoredState("organizeOffered", false);
  const load = (data, files) => {
    setSaveData(data);
    setRawFiles(data && files ? files : null);
  };
  const owned = useMemo(() => groupByKey(saveData?.items ?? []), [saveData]);
  // On the Deck, read the saves fresh every time the page opens
  const [deckError, setDeckError] = useState(null);
  const readDeck = useCallback(
    () =>
      deckSaveFiles()
        .then(parseSaveFiles)
        .then(
          (data) => (setSaveData(data), setDeckError(null)),
          (e) => setDeckError(e.message ?? String(e)),
        ),
    [setSaveData],
  );
  useEffect(() => {
    if (onDeck) readDeck();
  }, [readDeck]);
  // For screen readers and the right Chinese glyphs
  useEffect(() => {
    document.documentElement.lang = { zh: "zh-Hans", zh_tw: "zh-Hant", en: "en", ko: "ko" }[lang] ?? "en";
  }, [lang]);

  return (
    <div className="gothic-container">
      <header className="app-bar">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
          <Link to="/" className="app-title no-underline">
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
            {tab !== "welcome" && <SaveLoader saveData={saveData} onLoad={load} notStored={notStored} lang={lang} compact />}
            <div className="segmented" role="group" aria-label={t("language", lang)}>
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
        {deckError && <p className="text-red-400 mb-6">{t("readFailed", lang, deckError)}</p>}
        {rawFiles && !offered && tab !== "organize" && !onDeck && (
          <div className="panel mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 max-w-3xl">
            <span>{t("organizeOffer", lang)}</span>
            <Link to="/organize" className="gothic-btn gothic-btn-small no-underline" onClick={() => setOffered(true)}>
              {t("organizeOfferGo", lang)}
            </Link>
            <button className="text-sm gothic-text-muted" onClick={() => setOffered(true)}>
              {t("noThanks", lang)}
            </button>
          </div>
        )}
        <ErrorBoundary key={`${tab}/${name}`} lang={lang} onReset={() => load(null)}>
          {tab === "welcome" ? (
            <Welcome picker={<SaveLoader saveData={saveData} onLoad={load} notStored={notStored} lang={lang} />} lang={lang} />
          ) : tab === "faq" ? (
            <Faq lang={lang} />
          ) : tab === "search" ? (
            <SearchView owned={owned} lang={lang} />
          ) : tab === "organize" ? (
            <OrganizeView
              rawFiles={rawFiles}
              picker={<SaveLoader saveData={saveData} onLoad={load} notStored={notStored} lang={lang} />}
              onWritten={readDeck}
              lang={lang}
            />
          ) : tab === "characters" ? (
            saveData ? (
              <CharacterView saveData={saveData} name={name} lang={lang} />
            ) : (
              <SaveLoader saveData={saveData} onLoad={load} notStored={notStored} lang={lang} />
            )
          ) : (
            <CollectionView key={tab} label={t(tab, lang)} groups={collectionGroups(tab, lang)} owned={owned} lang={lang} />
          )}
        </ErrorBoundary>
      </main>
      <footer className="flex gap-6 text-sm gothic-text-muted mt-20">
        <Link to="/faq">{t("faq", lang)}</Link>
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
