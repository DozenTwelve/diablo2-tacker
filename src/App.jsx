import { useCallback, useEffect, useMemo, useState } from "react";
import { uniques, sets, runewords, runes, uniqueKey, setItemKey, runewordKey, runeKey } from "./lib/gameData";
import { groupByKey } from "./lib/inventory";
import { LANGS, LOCALES, nameOf, t } from "./lib/i18n";
import { useStoredState } from "./lib/useStoredState";
import { closeDeck, deckSaveFiles, onDeck } from "./lib/deck";
import { parseSaveFiles } from "./lib/parseSaves";
import SaveLoader from "./components/SaveLoader";
import SearchView from "./components/SearchView";
import CollectionView from "./components/CollectionView";
import CharacterView from "./components/CharacterView";
import OrganizeView from "./components/OrganizeView";
import Welcome from "./components/Welcome";
import AboutView from "./components/AboutView";
import NewItemsView from "./components/NewItemsView";
import ErrorBoundary from "./components/ErrorBoundary";
import { SET_GREEN } from "./components/StashGrid";
import { propLines, setBonusLines } from "./lib/props";
import { Link, usePath } from "./lib/router";

const TABS = ["new", "search", "collection", "characters", "organize", "about"];
// The collection's own pages, /collection/<page>; the old /uniques... paths still lead there
const COLLECTION = ["uniques", "sets", "runewords", "runes"];

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
  const [first, second] = usePath();
  // The front page is the welcome page until saves are loaded, then the new finds
  const tab = !first ? (saveData ? "new" : "welcome") : COLLECTION.includes(first) ? "collection" : TABS.includes(first) ? first : "search";
  const page = COLLECTION.includes(first) ? first : COLLECTION.includes(second) ? second : "uniques"; // of the collection
  const name = tab === "collection" ? page : second; // the character or collection page named in the path
  const [deckError, setDeckError] = useState(null); // the Deck's own read of the saves failed
  const [rawFiles, setRawFiles] = useState(null); // the files as last picked, for organizing; memory only
  const [offered, setOffered] = useStoredState("organizeOffered", false);
  const load = (data, files) => {
    setSaveData(data);
    setDeckError(null);
    setRawFiles(data && files ? files : null);
  };
  const owned = useMemo(() => groupByKey(saveData?.items ?? []), [saveData]);
  // On the Deck, read the saves fresh every time the page opens
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
  // For screen readers and the right Chinese glyphs; the tab's title names the page, in the page's language
  useEffect(() => {
    document.documentElement.lang = LOCALES[lang] ?? "en";
    document.title = [tab === "collection" ? t(name, lang) : name, tab !== "welcome" && t(tab, lang), t("title", lang)].filter(Boolean).join(" · ");
  }, [lang, tab, name]);

  return (
    <div className="gothic-container">
      <header className="app-bar">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
          <Link to="/" className="app-title no-underline">
            {t("title", lang)}
          </Link>
          <nav className="flex flex-wrap gap-x-5 gap-y-1 order-last w-full lg:order-none lg:w-auto">
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
            {onDeck && (
              <button className="gothic-btn gothic-btn-secondary gothic-btn-small" onClick={closeDeck}>
                {t("closeApp", lang)}
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {deckError && <p className="text-red-400 mb-6">{t("readFailed", lang, deckError)}</p>}
        {rawFiles?.some((f) => f.webkitRelativePath) && !offered && tab !== "organize" && !onDeck && (
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
          ) : tab === "about" ? (
            <AboutView lang={lang} />
          ) : tab === "new" ? (
            saveData ? (
              <NewItemsView saveData={saveData} lang={lang} />
            ) : (
              <SaveLoader saveData={saveData} onLoad={load} notStored={notStored} lang={lang} />
            )
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
            <>
              <nav className="flex flex-wrap gap-2 mb-6" aria-label={t("collection", lang)}>
                {COLLECTION.map((p) => {
                  const keys = collectionGroups(p, lang).flatMap((g) => g.keys);
                  return (
                    <Link
                      key={p}
                      to={`/collection/${p}`}
                      className={`gothic-btn gothic-btn-small no-underline ${p === page ? "" : "gothic-btn-secondary"}`}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {t(p, lang)} {keys.filter((k) => owned.has(k)).length}/{keys.length}
                    </Link>
                  );
                })}
              </nav>
              <CollectionView key={page} label={t(page, lang)} groups={collectionGroups(page, lang)} owned={owned} lang={lang} />
            </>
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
